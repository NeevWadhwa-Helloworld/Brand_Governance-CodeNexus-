from io import BytesIO
from typing import Any

from pypdf import PdfReader
from pypdf.errors import PyPdfError

from backend.services.rag_service import RAGService

MAX_GUIDELINE_PDF_BYTES = 15 * 1024 * 1024
MAX_GUIDELINE_PDF_PAGES = 500
MAX_GUIDELINE_PDF_PAGE_CHARS = 200_000
MAX_GUIDELINE_PDF_TEXT_CHARS = 2_000_000


def extract_pdf_rules(pdf_bytes: bytes) -> tuple[str, list[dict[str, Any]]]:
    try:
        reader = PdfReader(BytesIO(pdf_bytes))
    except (PyPdfError, OSError, ValueError) as exc:
        raise ValueError("Unreadable PDF: the file is damaged or is not a valid PDF.") from exc

    if reader.is_encrypted:
        raise ValueError("Encrypted PDFs are not supported. Upload an unencrypted PDF.")
    if len(reader.pages) > MAX_GUIDELINE_PDF_PAGES:
        raise ValueError(
            f"PDF exceeds the {MAX_GUIDELINE_PDF_PAGES}-page ingestion limit."
        )

    page_texts = []
    rules = []
    used_rule_ids: set[str] = set()
    extracted_characters = 0
    for page_number, page in enumerate(reader.pages, start=1):
        try:
            page_text = (page.extract_text() or "").strip()
        except (PyPdfError, OSError, ValueError) as exc:
            raise ValueError(
                f"Unreadable PDF: text could not be extracted from page {page_number}."
            ) from exc
        if not page_text:
            continue
        if len(page_text) > MAX_GUIDELINE_PDF_PAGE_CHARS:
            raise ValueError(
                f"PDF page {page_number} exceeds the "
                f"{MAX_GUIDELINE_PDF_PAGE_CHARS}-character ingestion limit."
            )
        extracted_characters += len(page_text)
        if extracted_characters > MAX_GUIDELINE_PDF_TEXT_CHARS:
            raise ValueError(
                f"PDF exceeds the {MAX_GUIDELINE_PDF_TEXT_CHARS}-character text limit."
            )
        page_texts.append(f"[PDF page {page_number}]\n{page_text}")
        page_rules = RAGService.split_and_extract_rules(page_text)
        if not page_rules:
            lines = [line.strip() for line in page_text.splitlines() if line.strip()]
            page_rules = [{
                "rule_id": f"PDF-{page_number:03d}-{line_number:03d}",
                "category": "tone",
                "title": line[:80],
                "text": line,
                "details": "",
            } for line_number, line in enumerate(lines, start=1)]

        for rule in page_rules:
            rule = dict(rule)
            base_id = rule["rule_id"]
            rule_id = base_id
            suffix = 1
            while rule_id in used_rule_ids:
                suffix += 1
                rule_id = f"{base_id}-P{page_number}-{suffix}"
            rule["rule_id"] = rule_id
            rule["source_page"] = page_number
            citation = f"Source: PDF page {page_number}."
            rule["details"] = " ".join(
                part for part in (rule.get("details", "").strip(), citation) if part
            )
            used_rule_ids.add(rule_id)
            rules.append(rule)

    if not page_texts:
        raise ValueError(
            "Empty PDF: no extractable text was found. Scanned or image-only PDFs are unsupported."
        )
    if not rules:
        raise ValueError("Empty PDF: no guideline rules could be extracted.")
    return "\n\n".join(page_texts), rules
