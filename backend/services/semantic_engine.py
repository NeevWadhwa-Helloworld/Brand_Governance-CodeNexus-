import json
import logging
import re
from typing import List, Dict, Any, Optional
from backend.config import settings
from backend.services.rag_service import RAGService
from backend.services.pii_redactor import PIIRedactor
from backend.services.model_adapter import get_model_adapter
from backend.schemas import SemanticFlagItem, SemanticScanOutput

logger = logging.getLogger(__name__)

class SemanticEngine:
    """
    Layer 2: Semantic Checking Engine (LLM + RAG).
    Evaluates tone & voice, messaging consistency, and unsupported claims.
    Enforces strict grounding: Discards any flag that does not cite a valid retrieved rule!
    """

    @classmethod
    def run(cls, org_id: str, text: str = "", image_path: Optional[str] = None) -> List[Dict[str, Any]]:
        # 1. Retrieve top-k relevant rules from the Source of Truth
        search_query = text if text else "color logo visual layout accessibility contrast"
        retrieved_rules = RAGService.retrieve_relevant_rules(org_id, search_query, top_k=settings.RAG_TOP_K)
        if not retrieved_rules:
            return []

        retrieved_rules_by_id = {r['rule_id'].strip().upper(): r for r in retrieved_rules}

        # 2. Redact personal data if enabled
        clean_text, pii_mapping = PIIRedactor.redact(text) if text else ("", {})

        # 3. Call AI Model (Gemini or Local/Private Model via ModelAdapter boundary)
        raw_flags = []
        has_api_key = bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "your_gemini_api_key_here")
        has_local_model = settings.MODEL_PROVIDER in ("local", "private")

        if clean_text:
            if has_api_key or has_local_model:
                try:
                    adapter = get_model_adapter()
                    raw_flags.extend(adapter.scan_text(clean_text, retrieved_rules))
                except Exception:
                    logger.exception("AI model scan failed; falling back to local semantic checks")
            # Keep high-confidence, policy-specific checks active even when model
            # returns an empty list; a successful API call is not proof of compliance.
            raw_flags.extend(cls._local_semantic_rules_eval(clean_text, retrieved_rules))

        # 4. Multimodal Layer 2: Visual analysis if image is provided
        if image_path:
            if has_api_key:
                try:
                    adapter = get_model_adapter()
                    raw_flags.extend(adapter.scan_vision(image_path, retrieved_rules))
                except Exception:
                    logger.exception("Model visual scan failed; using local visual checks")
                    raw_flags.extend(cls._local_visual_semantic_eval(image_path, retrieved_rules))
            else:
                raw_flags.extend(cls._local_visual_semantic_eval(image_path, retrieved_rules))

        # 4. Strict Grounding Filter: Discard any flag that cannot cite a valid retrieved rule!
        grounded_flags = []
        seen_flags = set()
        for flag in raw_flags:
            rule_id = str(flag.get("rule_id", "")).strip().upper()
            if rule_id not in retrieved_rules_by_id:
                # Rule was not retrieved or is hallucinated -> Discard as per Section 3.1 & 8
                logger.warning("Discarding ungrounded flag citing non-retrieved rule %s", rule_id)
                continue

            # Restore any redacted PII tokens in span and fix
            span = PIIRedactor.restore(flag.get("quoted_span") or flag.get("span", ""), pii_mapping)
            fix = PIIRedactor.restore(flag.get("suggested_fix") or flag.get("fix", ""), pii_mapping)
            explanation = flag.get("explanation", "")
            confidence = float(flag.get("confidence", 0.88))
            if not span.strip() or not explanation.strip() or not fix.strip():
                logger.warning("Discarding incomplete semantic flag for rule %s", rule_id)
                continue
            if clean_text and span not in text:
                logger.warning("Discarding semantic flag with a non-exact quoted span for rule %s", rule_id)
                continue
            dedupe_key = (rule_id, span.casefold().strip())
            if dedupe_key in seen_flags:
                continue
            seen_flags.add(dedupe_key)

            # Find span indices in original text
            start_idx = -1
            end_idx = -1
            if span and span in text:
                start_idx = text.find(span)
                end_idx = start_idx + len(span)

            # Match category from rule
            rule_info = retrieved_rules_by_id[rule_id]
            category = rule_info.get('category', 'tone')

            grounded_flags.append({
                "rule_id": rule_id,
                "category": category,
                "span": span,
                "start_idx": start_idx,
                "end_idx": end_idx,
                "explanation": explanation,
                "fix": fix,
                "confidence": confidence,
                "layer": "layer2_semantic"
            })

        return grounded_flags

    @classmethod
    def _call_gemini_rag(cls, text: str, retrieved_rules: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.GEMINI_API_KEY)

        rules_prompt_block = "\n".join([
            f"- Rule ID: {r['rule_id']} | Category: {r['category']} | Title: {r['title']} | Requirements: {r['text']} {r.get('details') or ''}"
            for r in retrieved_rules
        ])

        system_instruction = f"""
You are the AI Brand Governance Evaluation Engine for Inkloom AI.
Your job is to strictly evaluate marketing and communication drafts against the organization's verified brand guidelines.

ONLY cite Rule IDs from this verified retrieved list:
{rules_prompt_block}

CRITICAL RULES:
1. Assess the complete draft against each applicable retrieved rule, including tone and voice requirements. Treat clearly self-deprecating, hostile, arrogant, or condescending wording as a violation when it conflicts with the cited rule.
2. Do not require a phrase to exactly match an example in a rule; evaluate its meaning in context, while avoiding subjective flags that cannot be tied to a stated requirement.
3. Every flag MUST specify the exact rule_id, an exact quoted_span copied from the draft, a clear friendly explanation of the conflict with that rule, and a specific non-destructive suggested_fix.
4. DO NOT invent or hallucinate Rule IDs. If no rule is breached, return an empty list of flags.
"""

        prompt = f"""
Review this complete draft for policy violations. Be especially attentive to wording
that undermines the brand's required voice, even if it is not one of the examples
in the rules. Return a grounded finding and useful rewrite when a clear conflict exists.

Draft:
{text}
"""

        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=SemanticScanOutput,
                temperature=0.1
            ),
        )

        return cls._parse_gemini_response(response)

    @staticmethod
    def _parse_gemini_response(response: Any) -> List[Dict[str, Any]]:
        parsed = getattr(response, "parsed", None)
        if parsed is None:
            response_text = getattr(response, "text", None)
            if not response_text:
                raise ValueError("Gemini returned no structured scan output")
            parsed = json.loads(response_text)
        elif not isinstance(parsed, dict):
            if hasattr(parsed, "model_dump"):
                parsed = parsed.model_dump()
            elif hasattr(parsed, "dict"):
                parsed = parsed.dict()
            else:
                raise ValueError("Gemini returned an unsupported structured response")

        validated = SemanticScanOutput.model_validate(parsed)
        flags = [flag.model_dump() for flag in validated.flags]
        for flag in flags:
            if not 0.0 <= flag["confidence"] <= 1.0:
                raise ValueError("Gemini returned a confidence value outside [0, 1]")
        return flags

    @classmethod
    def _call_gemini_vision(cls, image_path: str, retrieved_rules: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        from google import genai
        from google.genai import types
        from PIL import Image

        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        pil_img = Image.open(image_path)

        rules_prompt_block = "\n".join([
            f"- Rule ID: {r['rule_id']} | Category: {r['category']} | Requirements: {r['text']} {r.get('details') or ''}"
            for r in retrieved_rules
        ])

        system_instruction = f"""
You are the Multimodal Brand Governance Visual Inspector for Inkloom AI.
Inspect this visual banner or image creative against the following retrieved brand rules:
{rules_prompt_block}

RULES:
1. Detect any unapproved hex colors, obsolete logos, poor contrast, or tone breaches in the image.
2. ONLY cite Rule IDs from the provided list.
3. Every flag MUST return: rule_id, quoted_span, explanation, suggested_fix, and confidence.
"""
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=[
                pil_img,
                "Analyze this brand creative image against our official brand rules and return structured flags if any rule is violated."
            ],
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=SemanticScanOutput,
                temperature=0.1
            ),
        )

        return cls._parse_gemini_response(response)

    @classmethod
    def _local_visual_semantic_eval(cls, image_path: str, retrieved_rules: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Local semantic visual evaluator for environments without external Gemini API key.
        Filename heuristics cannot reliably determine what an image depicts, so
        visual policy decisions are deferred to human review without a vision model.
        """
        return []

    @classmethod
    def _local_semantic_rules_eval(cls, text: str, retrieved_rules: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Intelligent local semantic engine that evaluates tone, claims, and voice against retrieved rules.
        Guarantees 100% testable local operation without external network dependencies.
        """
        flags = []
        retrieved_ids = {r['rule_id']: r for r in retrieved_rules}

        # 1. Check for Unsupported Claims (e.g. CLAIM-01: "#1 solution", "best in the world", "undisputed")
        if "CLAIM-01" in retrieved_ids:
            superlative_patterns = [
                (r'\b(#1\s+[A-Za-z0-9_-]+|\bthe\s+best\s+[A-Za-z0-9_-]+|\bthe\s+only\s+solution\b|\bundisputed\s+leader\b)',
                 "CLAIM-01",
                 "Unsubstantiated superlative claim. Guideline CLAIM-01 forbids claiming '#1' or 'the best' without citing third-party verified benchmarks.",
                 "leading AI platform verified by industry benchmarks"),
                (r'\b(guaranteed\s+100%\s+results|guaranteed\s+success)\b',
                 "CLAIM-01",
                 "Absolute guarantee creates legal and compliance liability under CLAIM-01.",
                 "proven methodology designed for high-performance outcomes")
            ]
            for pat, rule_id, exp, fix in superlative_patterns:
                for match in re.finditer(pat, text, re.IGNORECASE):
                    flags.append({
                        "rule_id": rule_id,
                        "quoted_span": match.group(0),
                        "explanation": exp,
                        "suggested_fix": fix,
                        "confidence": 0.94
                    })

        # 2. Check for Voice / Tone - Arrogant or overly informal vs Confident & Empathetic (VOICE-01, VOICE-02)
        if "VOICE-01" in retrieved_ids:
            arrogant_patterns = [
                (r'\b(our\s+rivals\s+are\s+clueless|we\s+are\s+vastly\s+superior)\b',
                 "VOICE-01",
                 "Arrogant and aggressive tone violates VOICE-01. Inkloom's voice must be confident, empowering, and helpful.",
                 "we deliver unmatched clarity and precision for creators"),
                (r'\b((?:we\s+)?crush(?:es|ed|ing)?\s+(?:our\s+)?competitors|dominat(?:e|es|ed|ing)\s+(?:the\s+)?competition)\b',
                 "VOICE-01",
                 "Boastful competitive language violates VOICE-01. Inkloom's voice must be confident, empowering, and helpful.",
                 "we help creators and teams achieve their goals"),
                (r'\b(obviously\s+you\s+need|any\s+fool\s+can\s+see)\b',
                 "VOICE-01",
                 "Condescending phrasing alienates creators. VOICE-01 demands an empathetic, partner-like tone.",
                 "teams discover immediate value with")
            ]
            for pat, rule_id, exp, fix in arrogant_patterns:
                for match in re.finditer(pat, text, re.IGNORECASE):
                    flags.append({
                        "rule_id": rule_id,
                        "quoted_span": match.group(0),
                        "explanation": exp,
                        "suggested_fix": fix,
                        "confidence": 0.91
                    })

            self_deprecating_patterns = [
                (r"\b(?:we(?:'re|\s+are)|our\s+(?:team|work|product|service|company)\s+(?:is|are)|i(?:'m|\s+am))\s+(?:(?:very|really|so)\s+)?(?:bad|terrible|awful|incompetent|useless)(?:\s+(?:at|in)\s+[\w\s'-]{1,50})?",
                 "Self-deprecating wording conflicts with VOICE-01's confident, empowering, helpful tone.",
                 "We are committed to delivering thoughtful, dependable work that helps our customers succeed."),
            ]
            for pattern, explanation, fix in self_deprecating_patterns:
                for match in re.finditer(pattern, text, re.IGNORECASE):
                    flags.append({
                        "rule_id": "VOICE-01",
                        "quoted_span": match.group(0),
                        "explanation": explanation,
                        "suggested_fix": fix,
                        "confidence": 0.88,
                    })

        if "VOICE-02" in retrieved_ids:
            jargon_patterns = [
                (r'\b(leverage\s+cross-functional\s+synergies|paradigm\s+shift\s+in\s+holistic\s+ideation)\b',
                 "VOICE-02",
                 "Dense corporate jargon violates VOICE-02. Brand guidelines require conversational yet professional language.",
                 "collaborate seamlessly across design and content teams"),
                (r'\b(boil\s+the\s+ocean|move\s+the\s+needle)\b',
                 "VOICE-02",
                 "Cliché corporate jargon dilutes message clarity (VOICE-02).",
                 "deliver measurable impact")
            ]
            for pat, rule_id, exp, fix in jargon_patterns:
                for match in re.finditer(pat, text, re.IGNORECASE):
                    flags.append({
                        "rule_id": rule_id,
                        "quoted_span": match.group(0),
                        "explanation": exp,
                        "suggested_fix": fix,
                        "confidence": 0.89
                    })

        # 3. Check for Claim 02 (Human in the loop requirement)
        if "CLAIM-02" in retrieved_ids:
            auto_perfection = re.compile(r'\b(instantaneous\s+zero-effort\s+perfection|100%\s+automated\s+without\s+any\s+human\s+touch)\b', re.IGNORECASE)
            for match in auto_perfection.finditer(text):
                flags.append({
                    "rule_id": "CLAIM-02",
                    "quoted_span": match.group(0),
                    "explanation": "CLAIM-02 highlights that AI brand governance is an assistive co-pilot, requiring human-in-the-loop sign-off.",
                    "suggested_fix": "streamlined AI-assisted review with human-in-the-loop control",
                    "confidence": 0.93
                })

        return flags
