from io import BytesIO

import pytest
from pypdf import PdfWriter
from pypdf.generic import (
    DecodedStreamObject,
    DictionaryObject,
    NameObject,
    NumberObject,
)

from backend.services.guideline_ingestion import extract_pdf_rules


def make_pdf(*page_texts, password=None):
    writer = PdfWriter()
    for text in page_texts:
        page = writer.add_blank_page(width=612, height=792)
        font = DictionaryObject({
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        })
        font_ref = writer._add_object(font)
        page[NameObject("/Resources")] = DictionaryObject({
            NameObject("/Font"): DictionaryObject({NameObject("/F1"): font_ref})
        })
        stream = DecodedStreamObject()
        stream.set_data(f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode())
        page[NameObject("/Contents")] = writer._add_object(stream)
    if password:
        writer.encrypt(password)
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


def test_extract_pdf_rules_preserves_page_citations():
    pdf = make_pdf(
        "VOICE-01: Clear voice",
        "CLAIM-01: Accurate claims",
    )

    text, rules = extract_pdf_rules(pdf)

    assert "[PDF page 1]" in text
    assert "[PDF page 2]" in text
    assert [rule["source_page"] for rule in rules] == [1, 2]
    assert "Source: PDF page 1." in rules[0]["details"]
    assert "Source: PDF page 2." in rules[1]["details"]


@pytest.mark.parametrize(
    ("pdf", "message"),
    [
        (make_pdf("", ""), "Empty PDF"),
        (make_pdf("Encrypted policy text", password="secret"), "Encrypted PDFs"),
        (b"not a pdf", "Unreadable PDF"),
    ],
)
def test_extract_pdf_rules_rejects_unsupported_or_unreadable_pdf(pdf, message):
    with pytest.raises(ValueError, match=message):
        extract_pdf_rules(pdf)
