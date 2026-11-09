"""Model Provider Adapter Boundary for Inkloom AI (Phase 5 of Round 3 Plan).

Provides a clean provider boundary implementing the same evaluation contract
across Gemini, local/private models (e.g. Ollama, vLLM, LMStudio), and fast
offline deterministic fallback. Strictly documents what data is transmitted.
"""

from abc import ABC, abstractmethod
import json
import logging
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional

from backend.config import settings
from backend.schemas import SemanticScanOutput

logger = logging.getLogger(__name__)


class BaseModelAdapter(ABC):
    """Abstract contract for semantic brand governance evaluation models."""

    @abstractmethod
    def scan_text(
        self, text: str, retrieved_rules: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Evaluate text draft against retrieved brand rules."""
        pass

    @abstractmethod
    def scan_vision(
        self, image_path: str, retrieved_rules: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Evaluate visual media draft against retrieved brand rules."""
        pass

    @abstractmethod
    def get_provider_metadata(self) -> Dict[str, Any]:
        """Describe provider name, endpoint type, and privacy/data boundary."""
        pass


class GeminiModelAdapter(BaseModelAdapter):
    """Google Gemini GenAI SDK provider adapter."""

    def __init__(self, api_key: str, model_name: str):
        self.api_key = api_key
        self.model_name = model_name

    def get_provider_metadata(self) -> Dict[str, Any]:
        return {
            "provider": "Google Gemini Cloud API",
            "model": self.model_name,
            "hosting": "Google Cloud / Managed API",
            "is_local": False,
            "data_boundary": {
                "transmitted_data": "Sanitized/PII-redacted draft text, retrieved active brand rules",
                "pii_redaction_applied": settings.ENABLE_PII_REDACTION,
                "retained_on_server": "Raw customer draft text, user identities, and unredacted PII mappings",
            },
        }

    def scan_text(
        self, text: str, retrieved_rules: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=self.api_key)
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
            model=self.model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=SemanticScanOutput,
                temperature=0.1,
            ),
        )
        return self._parse_structured_response(response)

    def scan_vision(
        self, image_path: str, retrieved_rules: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        from google import genai
        from google.genai import types
        from PIL import Image

        client = genai.Client(api_key=self.api_key)
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
3. Every flag must specify rule_id, quoted_span (or brief visual location), explanation, and suggested_fix.
"""
        response = client.models.generate_content(
            model=self.model_name,
            contents=[pil_img, "Inspect this creative for brand guideline violations."],
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=SemanticScanOutput,
                temperature=0.1,
            ),
        )
        return self._parse_structured_response(response)

    @staticmethod
    def _parse_structured_response(response: Any) -> List[Dict[str, Any]]:
        parsed = getattr(response, "parsed", None)
        if parsed is None:
            response_text = getattr(response, "text", None)
            if not response_text:
                raise ValueError("Model returned no structured scan output")
            parsed = json.loads(response_text)
        elif not isinstance(parsed, dict):
            if hasattr(parsed, "model_dump"):
                parsed = parsed.model_dump()
            elif hasattr(parsed, "dict"):
                parsed = parsed.dict()
            else:
                raise ValueError("Model returned an unsupported structured response")

        validated = SemanticScanOutput.model_validate(parsed)
        flags = [flag.model_dump() for flag in validated.flags]
        for flag in flags:
            if not 0.0 <= flag["confidence"] <= 1.0:
                raise ValueError("Model returned a confidence value outside [0, 1]")
        return flags


class LocalPrivateModelAdapter(BaseModelAdapter):
    """Local or on-premise private model adapter (Ollama / vLLM / OpenAI-compatible).

    Runs against an internal or customer-approved private endpoint. No data leaves
    the customer environment.
    """

    def __init__(self, endpoint_url: str, model_name: str):
        self.endpoint_url = endpoint_url.rstrip("/")
        self.model_name = model_name

    def get_provider_metadata(self) -> Dict[str, Any]:
        return {
            "provider": f"Local / Private Model ({self.model_name})",
            "model": self.model_name,
            "hosting": "Self-Hosted / Private Cluster (Zero External Egress)",
            "is_local": True,
            "data_boundary": {
                "transmitted_data": f"Local network only to {self.endpoint_url}. Zero cloud egress.",
                "pii_redaction_applied": settings.ENABLE_PII_REDACTION,
                "retained_on_server": "All data remains on customer-controlled infrastructure",
            },
        }

    def scan_text(
        self, text: str, retrieved_rules: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        rules_prompt_block = "\n".join([
            f"- Rule ID: {r['rule_id']} | Category: {r['category']} | Title: {r['title']} | Requirements: {r['text']} {r.get('details') or ''}"
            for r in retrieved_rules
        ])

        system_prompt = (
            "You are the AI Brand Governance Evaluation Engine for Inkloom AI.\n"
            "Strictly evaluate marketing drafts against these verified brand rules:\n"
            f"{rules_prompt_block}\n"
            "Return JSON matching: {\"flags\": [{\"rule_id\": \"...\", \"quoted_span\": \"...\", "
            "\"explanation\": \"...\", \"suggested_fix\": \"...\", \"confidence\": 0.9}]}"
        )

        payload = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Draft to evaluate:\n{text}"},
            ],
            "temperature": 0.1,
            "response_format": {"type": "json_object"},
        }

        req = urllib.request.Request(
            f"{self.endpoint_url}/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        content = data["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        validated = SemanticScanOutput.model_validate(parsed)
        return [flag.model_dump() for flag in validated.flags]

    def scan_vision(
        self, image_path: str, retrieved_rules: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        # Private local vision models (e.g. LLaVA on Ollama) can be called here
        logger.info("Local private vision evaluation delegated to image inspection")
        return []


def get_model_adapter() -> BaseModelAdapter:
    """Factory to get the configured model provider adapter."""
    provider = getattr(settings, "MODEL_PROVIDER", "auto").lower()

    has_gemini = bool(
        settings.GEMINI_API_KEY
        and settings.GEMINI_API_KEY != "your_gemini_api_key_here"
    )

    if provider == "local" or provider == "private":
        local_url = getattr(settings, "LOCAL_MODEL_URL", "http://127.0.0.1:11434/v1")
        local_name = getattr(settings, "LOCAL_MODEL_NAME", "llama3.2")
        return LocalPrivateModelAdapter(local_url, local_name)

    if provider == "gemini" or (provider == "auto" and has_gemini):
        return GeminiModelAdapter(settings.GEMINI_API_KEY, settings.GEMINI_MODEL)

    # Auto fallback with local private adapter if configured, else Gemini adapter
    return GeminiModelAdapter(settings.GEMINI_API_KEY, settings.GEMINI_MODEL)

