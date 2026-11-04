import re
from typing import Tuple, Dict
from backend.config import settings

EMAIL_REGEX = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b')
PHONE_REGEX = re.compile(r'\b(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})\b')
SSN_REGEX = re.compile(r'\b\d{3}-\d{2}-\d{4}\b')

class PIIRedactor:
    """
    Optional redaction of personal data before text leaves the platform for a model call.
    (Section 6.2 Security and Privacy Measures)
    """

    @classmethod
    def redact(cls, text: str) -> Tuple[str, Dict[str, str]]:
        if not settings.ENABLE_PII_REDACTION or not text:
            return text, {}

        mapping: Dict[str, str] = {}
        redacted = text

        # Redact emails
        def replace_email(match):
            token = f"[REDACTED_EMAIL_{len(mapping)+1}]"
            val = match.group(0)
            mapping[token] = val
            return token

        redacted = EMAIL_REGEX.sub(replace_email, redacted)

        # Redact phone numbers
        def replace_phone(match):
            token = f"[REDACTED_PHONE_{len(mapping)+1}]"
            val = match.group(0)
            mapping[token] = val
            return token

        redacted = PHONE_REGEX.sub(replace_phone, redacted)

        # Redact SSNs
        def replace_ssn(match):
            token = f"[REDACTED_ID_{len(mapping)+1}]"
            val = match.group(0)
            mapping[token] = val
            return token

        redacted = SSN_REGEX.sub(replace_ssn, redacted)

        return redacted, mapping

    @classmethod
    def restore(cls, text: str, mapping: Dict[str, str]) -> str:
        restored = text
        for token, val in mapping.items():
            restored = restored.replace(token, val)
        return restored
