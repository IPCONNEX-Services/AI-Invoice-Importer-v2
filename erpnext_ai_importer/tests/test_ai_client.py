import json
from unittest.mock import patch, MagicMock
from erpnext_ai_importer.utils.ai_client import (
    _parse_json,
    EXTRACTION_PROMPT,
    _build_prompt,
)


def test_parse_json_plain():
    result = _parse_json('{"invoice_number": "INV-001", "total": 100.0}')
    assert result["invoice_number"] == "INV-001"
    assert result["total"] == 100.0


def test_parse_json_strips_markdown_fence():
    raw = "```json\n{\"invoice_number\": \"INV-001\"}\n```"
    result = _parse_json(raw)
    assert result["invoice_number"] == "INV-001"


def test_parse_json_strips_plain_fence():
    raw = "```\n{\"total\": 50.0}\n```"
    result = _parse_json(raw)
    assert result["total"] == 50.0


def test_build_prompt_contains_text():
    prompt = _build_prompt("Invoice text here")
    assert "Invoice text here" in prompt
    assert "JSON" in prompt


def test_extraction_prompt_has_schema_fields():
    assert "invoice_number" in EXTRACTION_PROMPT
    assert "supplier_name" in EXTRACTION_PROMPT
    assert "line_items" in EXTRACTION_PROMPT
    assert "confidence_score" in EXTRACTION_PROMPT
