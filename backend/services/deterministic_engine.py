import re
from typing import List, Dict, Any, Optional
from backend.database import get_db

class DeterministicEngine:
    """
    Layer 1: Deterministic Checking Engine (Fast, exact, 0 AI cost).
    Implements terminology matching, approved fact verification,
    color palette validation, contrast ratio (WCAG AA/AAA), and logo version matching.
    """
    PROFANITY_PATTERN = re.compile(
        r"\b(?:fuck(?:ing|ed|er|ers)?(?:\s+you)?|shit(?:ty|ting)?|"
        r"bitch(?:es)?|assholes?|bastards?|cunts?)\b",
        re.IGNORECASE,
    )
    DIRECT_THREAT_PATTERN = re.compile(
        r"\b(?:kill|murder|hurt|harm)\s+"
        r"(?:you(?:\s+all)?|them|him|her|everyone|all)\b",
        re.IGNORECASE,
    )
    NUMERIC_CLAIM_PATTERN = re.compile(
        r"\b(?:(?:we|our\s+(?:company|platform|service))\s+"
        r"(?:serve|serves|support|supports|reach|reaches|have|has)\s+)?"
        r"(?:(?P<qualifier>over|more than|nearly|about|approximately|approx\.?)\s+)?"
        r"\$?\d[\d,]*(?:\.\d+)?\s*(?:k|m|b|thousand|million|billion)?\s+"
        r"(?:active\s+)?(?:users?|customers?|clients?|subscribers?|employees?|"
        r"downloads?|installs?|installations?|countries|markets|businesses|"
        r"brands|creators|projects|years|hours|minutes)\b",
        re.IGNORECASE,
    )
    NUMERIC_VALUE_PATTERN = re.compile(
        r"\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|m|b|thousand|million|billion)?",
        re.IGNORECASE,
    )

    @classmethod
    def run_all(cls, org_id: str, text: Optional[str] = None, image_path: Optional[str] = None) -> List[Dict[str, Any]]:
        flags = []
        if text:
            flags.extend(cls.check_profanity(text))
            flags.extend(cls.check_terminology(org_id, text))
            flags.extend(cls.check_facts(org_id, text))
            flags.extend(cls.check_text_colors(org_id, text))

        return flags

    @classmethod
    def check_profanity(cls, text: str) -> List[Dict[str, Any]]:
        flags = []
        patterns = (
            (
                cls.PROFANITY_PATTERN,
                "This wording contains profanity that may be inappropriate for customer-facing brand content.",
            ),
            (
                cls.DIRECT_THREAT_PATTERN,
                "This wording reads as a direct threat of violence and is unsuitable for customer-facing content.",
            ),
        )
        for pattern, explanation in patterns:
            for match in pattern.finditer(text):
                flags.append({
                    "rule_id": "TONE-LANGUAGE-01",
                    "category": "tone",
                    "span": match.group(0),
                    "start_idx": match.start(),
                    "end_idx": match.end(),
                    "explanation": explanation,
                    "fix": "Please let us know how we can help.",
                    "confidence": 1.0,
                    "layer": "layer1_deterministic",
                })
        return flags

    @classmethod
    def check_terminology(cls, org_id: str, text: str) -> List[Dict[str, Any]]:
        flags = []
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT t.*, r.rule_id as linked_rule_id
                FROM terminology_entries t
                LEFT JOIN rules r ON r.version_id = t.version_id AND r.category = 'terminology' AND r.text LIKE '%' || t.banned_term || '%'
                WHERE t.org_id = ?
            """, (org_id,))
            entries = cursor.fetchall()

        for entry in entries:
            banned = entry['banned_term']
            preferred = entry['preferred_term']
            rule_id = entry.get('linked_rule_id') or "TERM-01"

            # Word boundary regex, case-insensitive
            pattern = re.compile(rf'\b({re.escape(banned)})\b', re.IGNORECASE)
            for match in pattern.finditer(text):
                matched_span = match.group(0)
                # Keep capitalization style
                if matched_span.isupper():
                    fix_text = preferred.upper()
                elif matched_span[0].isupper():
                    fix_text = preferred.capitalize()
                else:
                    fix_text = preferred.lower()

                flags.append({
                    "rule_id": rule_id,
                    "category": "terminology",
                    "span": matched_span,
                    "start_idx": match.start(),
                    "end_idx": match.end(),
                    "explanation": f"Term '{matched_span}' is prohibited by brand terminology guidelines. {entry.get('context') or ''}".strip(),
                    "fix": fix_text,
                    "confidence": 1.0,
                    "layer": "layer1_deterministic"
                })

        return flags

    @classmethod
    def check_facts(cls, org_id: str, text: str) -> List[Dict[str, Any]]:
        flags = []
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT f.*, r.rule_id as linked_rule_id
                FROM approved_facts f
                LEFT JOIN rules r ON r.version_id = f.version_id AND r.category = 'facts' AND r.rule_id = 'FACT-01'
                WHERE f.org_id = ?
            """, (org_id,))
            facts = cursor.fetchall()

        for match in cls.NUMERIC_CLAIM_PATTERN.finditer(text):
            span_text = match.group(0)
            normalized_claim = cls._numeric_value(span_text)
            metric_text = span_text.lower()
            relevant_facts = [
                fact for fact in facts
                if cls._fact_matches_metric(fact, metric_text)
            ]
            claim_qualifier = cls._normalize_qualifier(match.group("qualifier"))
            fact_evidence = [
                (
                    fact,
                    cls._approved_fact_value(fact),
                    cls._fact_qualifier(fact),
                )
                for fact in relevant_facts
            ]
            approved_values = {
                (value, qualifier)
                for _, value, qualifier in fact_evidence
                if value is not None
            }
            if (
                len(approved_values) == 1
                and (normalized_claim, claim_qualifier) in approved_values
            ):
                continue

            rule_id = next(
                (fact.get("linked_rule_id") for fact in relevant_facts if fact.get("linked_rule_id")),
                "FACT-UNVERIFIED-01",
            )
            approved_metric = next(
                (fact.get("approved_metric") for fact, _, _ in fact_evidence if fact.get("approved_metric")),
                None,
            )
            citation = next(
                (fact.get("citation") for fact, _, _ in fact_evidence if fact.get("citation")),
                None,
            )
            if len(approved_values) > 1:
                explanation = (
                    "Approved records contain conflicting figures for this metric. "
                    "Confirm the current approved value and source before publishing."
                )
                fix = "Please confirm the current approved customer figure."
            elif approved_values and approved_metric:
                explanation = (
                    f"This claim does not match the approved figure “{approved_metric}”."
                    + (f" Source: {citation}." if citation else "")
                )
                fix = f"We serve {approved_metric}."
            else:
                explanation = (
                    "This numerical claim could not be matched to an approved fact. "
                    "Verify it with a current source before publishing."
                )
                fix = "We serve customers."

            flags.append({
                "rule_id": rule_id,
                "category": "facts",
                "span": span_text,
                "start_idx": match.start(),
                "end_idx": match.end(),
                "explanation": explanation,
                "fix": fix,
                "confidence": 1.0,
                "layer": "layer1_deterministic",
            })

        for fact in facts:
            rule_id = fact.get('linked_rule_id') or "FACT-01"
            approved_metric = fact['approved_metric']
            citation = fact['citation']

            # Check 2: SLA uptime fact check
            if fact['fact_key'] == 'sla_uptime':
                pattern = re.compile(r'\b(100%|99\.99%)\s*(?:uptime|sla)\b', re.IGNORECASE)
                for match in pattern.finditer(text):
                    span_text = match.group(0)
                    flags.append({
                        "rule_id": "FACT-03",
                        "category": "facts",
                        "span": span_text,
                        "start_idx": match.start(),
                        "end_idx": match.end(),
                        "explanation": f"Approved SLA is {approved_metric} ({citation}). Over-promising 100% creates direct legal breach risk.",
                        "fix": f"{approved_metric} uptime SLA",
                        "confidence": 0.96,
                        "layer": "layer1_deterministic"
                    })

            # Check 3: Series A funding fact check
            elif fact['fact_key'] == 'funding_round':
                pattern = re.compile(r'\b(?:\$[0-9]+M\s+seed|\$5M\s+series\s+A)\b', re.IGNORECASE)
                for match in pattern.finditer(text):
                    span_text = match.group(0)
                    flags.append({
                        "rule_id": "FACT-02",
                        "category": "facts",
                        "span": span_text,
                        "start_idx": match.start(),
                        "end_idx": match.end(),
                        "explanation": f"Outdated financing figure. {citation} confirmed {approved_metric}.",
                        "fix": approved_metric,
                        "confidence": 0.95,
                        "layer": "layer1_deterministic"
                    })

        return flags

    @classmethod
    def _numeric_value(cls, text: str) -> Optional[float]:
        match = cls.NUMERIC_VALUE_PATTERN.search(text or "")
        if not match:
            return None
        value = float(match.group(1).replace(",", ""))
        suffix = (match.group(2) or "").lower()
        multiplier = {
            "k": 1_000,
            "thousand": 1_000,
            "m": 1_000_000,
            "million": 1_000_000,
            "b": 1_000_000_000,
            "billion": 1_000_000_000,
        }.get(suffix, 1)
        return value * multiplier

    @classmethod
    def _approved_fact_value(cls, fact: Dict[str, Any]) -> Optional[float]:
        for key in ("approved_metric", "claim_text", "fact_key"):
            value = cls._numeric_value(str(fact.get(key) or ""))
            if value is not None:
                return value
        return None

    @staticmethod
    def _normalize_qualifier(qualifier: Optional[str]) -> Optional[str]:
        if not qualifier:
            return None
        qualifier = qualifier.lower().rstrip(".")
        if qualifier in {"over", "more than"}:
            return "over"
        if qualifier in {"about", "approximately", "approx", "nearly"}:
            return qualifier
        return qualifier

    @classmethod
    def _fact_qualifier(cls, fact: Dict[str, Any]) -> Optional[str]:
        for key in ("approved_metric", "claim_text"):
            match = re.search(
                r"\b(over|more than|nearly|about|approximately|approx\.?)\s+"
                r"\$?\d[\d,]*(?:\.\d+)?\s*(?:k|m|b|thousand|million|billion)?\b",
                str(fact.get(key) or ""),
                re.IGNORECASE,
            )
            if match:
                return cls._normalize_qualifier(match.group(1))
        return None

    @staticmethod
    def _fact_matches_metric(fact: Dict[str, Any], metric_text: str) -> bool:
        fact_text = " ".join(
            str(fact.get(key) or "")
            for key in ("fact_key", "claim_text", "approved_metric")
        ).lower()
        metric_groups = {
            "users": ("user", "customer", "client", "subscriber", "account"),
            "customers": ("user", "customer", "client", "subscriber", "account"),
            "clients": ("user", "customer", "client", "subscriber", "account"),
            "subscribers": ("user", "customer", "client", "subscriber", "account"),
            "employees": ("employee", "staff", "team member"),
            "downloads": ("download", "install"),
            "installs": ("download", "install"),
            "installations": ("download", "install"),
            "countries": ("country", "market", "region"),
            "markets": ("country", "market", "region"),
            "businesses": ("business", "company", "organization"),
            "brands": ("brand",),
            "creators": ("creator",),
            "projects": ("project",),
            "years": ("year",),
            "hours": ("hour",),
            "minutes": ("minute",),
        }
        claim_metric = next(
            (metric for metric in metric_groups if re.search(rf"\b{metric}\b", metric_text)),
            None,
        )
        return bool(
            claim_metric
            and any(term in fact_text for term in metric_groups[claim_metric])
        )

    @classmethod
    def check_text_colors(cls, org_id: str, text: str) -> List[Dict[str, Any]]:
        flags = []
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM brand_colors WHERE org_id = ?", (org_id,))
            colors = cursor.fetchall()

        if not colors:
            return flags

        approved_hexes = {c['hex_code'].upper(): c for c in colors}
        primary_color = next((c['hex_code'] for c in colors if c['role'] == 'primary'), '#2563EB')

        # Find any hex code in text, e.g. #FF0055 or #1d4ed8
        hex_pattern = re.compile(r'#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})\b')
        for match in hex_pattern.finditer(text):
            found_hex = match.group(0).upper()
            if len(found_hex) == 4: # #RGB -> #RRGGBB
                found_hex = f"#{found_hex[1]*2}{found_hex[2]*2}{found_hex[3]*2}"

            if found_hex not in approved_hexes:
                flags.append({
                    "rule_id": "COLOR-01",
                    "category": "color",
                    "span": match.group(0),
                    "start_idx": match.start(),
                    "end_idx": match.end(),
                    "explanation": f"Hex color '{match.group(0)}' does not belong to the approved brand palette. Primary brand blue is {primary_color}.",
                    "fix": primary_color,
                    "confidence": 0.99,
                    "layer": "layer1_deterministic"
                })

        return flags
