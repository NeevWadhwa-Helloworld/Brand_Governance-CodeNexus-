import math
import re
from typing import List, Dict, Any
from backend.database import get_db
from backend.config import settings

class RAGService:
    """
    Retrieval-Augmented Generation Service:
    Splits guidelines into numbered rules, computes retrievable representations,
    and returns only top relevant rules for grounding semantic checks.
    """

    @classmethod
    def tokenize(cls, text: str) -> List[str]:
        return [w.lower() for w in re.findall(r'\b[A-Za-z0-9_-]{2,}\b', text)]

    @classmethod
    def compute_similarity(cls, query_tokens: List[str], doc_tokens: List[str]) -> float:
        if not query_tokens or not doc_tokens:
            return 0.0
        q_set = set(query_tokens)
        d_set = set(doc_tokens)
        intersection = q_set.intersection(d_set)
        if not intersection:
            return 0.0
        # Cosine similarity on binary occurrence vectors
        return len(intersection) / (math.sqrt(len(q_set)) * math.sqrt(len(d_set)))

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
    def retrieve_relevant_rules(cls, org_id: str, text: str, top_k: int = 8) -> List[Dict[str, Any]]:
        rules = cls.get_active_rules(org_id)
        if not rules:
            return []

        query_tokens = cls.tokenize(text)
        scored_rules = []

        for rule in rules:
            rule_text = f"{rule['rule_id']} {rule['category']} {rule['title']} {rule['text']} {rule.get('details') or ''}"
            doc_tokens = cls.tokenize(rule_text)
            score = cls.compute_similarity(query_tokens, doc_tokens)

            # Boost semantic category rules for text (tone, voice, claims)
            if rule['category'] in ('tone', 'claims'):
                score += 0.25

            scored_rules.append((score, rule))

        scored_rules.sort(key=lambda x: x[0], reverse=True)
        return [r for _, r in scored_rules[:top_k]]

    @classmethod
    def split_and_extract_rules(cls, raw_guideline_text: str) -> List[Dict[str, Any]]:
        """
        Parses raw guidelines text/markdown into structured numbered rules.
        """
        extracted = []
        lines = raw_guideline_text.splitlines()
        current_rule = None

        rule_header_regex = re.compile(r'^(?:#+\s*)?([A-Z]{3,6}-\d{1,3}):?\s*(.*)$', re.IGNORECASE)

        for line in lines:
            line_str = line.strip()
            if not line_str:
                continue

            match = rule_header_regex.match(line_str)
            if match:
                if current_rule:
                    extracted.append(current_rule)
                raw_code = match.group(1).upper()
                title = match.group(2).strip() or raw_code
                
                # Determine category from prefix
                cat = "tone"
                if "COLOR" in raw_code or "COL" in raw_code:
                    cat = "color"
                elif "FACT" in raw_code:
                    cat = "facts"
                elif "CLAIM" in raw_code:
                    cat = "claims"
                elif "TERM" in raw_code:
                    cat = "terminology"
                elif "LOGO" in raw_code:
                    cat = "logo"
                elif "A11Y" in raw_code or "CONTRAST" in raw_code:
                    cat = "accessibility"

                current_rule = {
                    "rule_id": raw_code,
                    "category": cat,
                    "title": title,
                    "text": title,
                    "details": ""
                }
            else:
                if current_rule:
                    if current_rule["details"]:
                        current_rule["details"] += " " + line_str
                    else:
                        current_rule["details"] = line_str
                    # Expand text representation
                    current_rule["text"] = f"{current_rule['title']} - {current_rule['details']}"

        if current_rule:
            extracted.append(current_rule)

        return extracted
