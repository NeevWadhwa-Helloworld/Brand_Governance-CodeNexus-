import json
import logging
import math
import re
from typing import List, Dict, Any

from backend.config import settings
from backend.database import get_db
from backend.services.embedding_service import EmbeddingService

logger = logging.getLogger(__name__)


class RAGService:
    """Grounded rule retrieval with pgvector and a safe lexical fallback."""

    @classmethod
    def tokenize(cls, text: str) -> List[str]:
        return [w.lower() for w in re.findall(r"\b[A-Za-z0-9_-]{2,}\b", text)]

    @classmethod
    def compute_similarity(cls, query_tokens: List[str], doc_tokens: List[str]) -> float:
        if not query_tokens or not doc_tokens:
            return 0.0
        q_set, d_set = set(query_tokens), set(doc_tokens)
        intersection = q_set.intersection(d_set)
        return len(intersection) / (math.sqrt(len(q_set)) * math.sqrt(len(d_set))) if intersection else 0.0

    @classmethod
    def get_active_rules(cls, org_id: str) -> List[Dict[str, Any]]:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT r.* FROM rules r
                JOIN guideline_versions gv ON r.version_id = gv.id
                WHERE r.org_id = ? AND r.is_active = 1 AND gv.is_active = 1
                ORDER BY r.rule_id ASC
            """, (org_id,))
            return cursor.fetchall()

    @classmethod
    def _lexical_retrieve(cls, rules: List[Dict[str, Any]], text: str, top_k: int) -> List[Dict[str, Any]]:
        query_tokens = cls.tokenize(text)
        scored_rules = []
        for rule in rules:
            rule_text = f"{rule['rule_id']} {rule['category']} {rule['title']} {rule['text']} {rule.get('details') or ''}"
            score = cls.compute_similarity(query_tokens, cls.tokenize(rule_text))
            if rule["category"] in ("tone", "claims"):
                score += 0.25
            scored_rules.append((score, rule))
        scored_rules.sort(key=lambda item: item[0], reverse=True)
        return [rule for _, rule in scored_rules[:top_k]]

    @classmethod
    def retrieve_relevant_rules(cls, org_id: str, text: str, top_k: int = 8) -> List[Dict[str, Any]]:
        rules = cls.get_active_rules(org_id)
        if not rules:
            return []

        try:
            query_embedding = EmbeddingService.embed(text)
        except Exception:
            logger.exception("Embedding provider failed; using lexical policy retrieval")
            query_embedding = None

        if query_embedding:
            if settings.is_postgres:
                try:
                    with get_db() as conn:
                        cursor = conn.cursor()
                        cursor.execute("""
                            SELECT r.* FROM rules r
                            JOIN guideline_versions gv ON r.version_id = gv.id
                            WHERE r.org_id = ? AND r.is_active = 1 AND gv.is_active = 1
                              AND r.embedding IS NOT NULL
                            ORDER BY r.embedding <=> ?::vector
                            LIMIT ?
                        """, (org_id, EmbeddingService.to_vector_literal(query_embedding), top_k))
                        vector_rules = cursor.fetchall()
                        if vector_rules:
                            return vector_rules
                except Exception:
                    logger.exception("Vector policy retrieval failed; using lexical retrieval")
            else:
                vector_rules = []
                for rule in rules:
                    raw = rule.get("embedding_json")
                    if not raw:
                        continue
                    try:
                        values = json.loads(raw)
                        dot = sum(a * b for a, b in zip(query_embedding, values))
                        norm = math.sqrt(sum(a * a for a in query_embedding)) * math.sqrt(sum(b * b for b in values))
                        vector_rules.append((dot / norm if norm else 0.0, rule))
                    except (TypeError, ValueError, json.JSONDecodeError):
                        continue
                if vector_rules:
                    vector_rules.sort(key=lambda item: item[0], reverse=True)
                    return [rule for _, rule in vector_rules[:top_k]]

        return cls._lexical_retrieve(rules, text, top_k)

    @classmethod
    def split_and_extract_rules(cls, raw_guideline_text: str) -> List[Dict[str, Any]]:
        extracted = []
        current_rule = None
        regex = re.compile(r"^(?:#+\s*)?([A-Z]{3,6}-\d{1,3}):?\s*(.*)$", re.IGNORECASE)
        for line in raw_guideline_text.splitlines():
            line_str = line.strip()
            if not line_str:
                continue
            match = regex.match(line_str)
            if match:
                if current_rule:
                    extracted.append(current_rule)
                raw_code = match.group(1).upper()
                title = match.group(2).strip() or raw_code
                category = "tone"
                for prefix, candidate in (
                    ("COLOR", "color"), ("FACT", "facts"), ("CLAIM", "claims"),
                    ("TERM", "terminology"), ("LOGO", "logo"), ("A11Y", "accessibility")
                ):
                    if prefix in raw_code:
                        category = candidate
                        break
                current_rule = {"rule_id": raw_code, "category": category, "title": title, "text": title, "details": ""}
            elif current_rule:
                current_rule["details"] = f"{current_rule['details']} {line_str}".strip()
                current_rule["text"] = f"{current_rule['title']} - {current_rule['details']}"
        if current_rule:
            extracted.append(current_rule)
        return extracted
