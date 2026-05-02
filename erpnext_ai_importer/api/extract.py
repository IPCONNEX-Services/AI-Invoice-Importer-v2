import json
import frappe
from erpnext_ai_importer.utils.pdf_extractor import extract_text_with_fallback
from erpnext_ai_importer.utils.ai_client import extract_invoice_data
from erpnext_ai_importer.utils.fuzzy_matcher import match_supplier, best_item_match


def run_extraction(import_name):
    """
    Background job. Runs the full extraction pipeline for one AI Document Import record.
    Called via frappe.enqueue — not a whitelist method.
    """
    doc = frappe.get_doc("AI Document Import", import_name)
    settings = frappe.get_single("AI Import Settings")
    success = 0
    tokens_used = 0

    try:
        doc.status = "Extracting"
        doc.save(ignore_permissions=True)
        frappe.db.commit()

        provider = doc.provider_used or settings.default_provider or "Claude"
        model = _resolve_model(settings, provider)
        api_key = _resolve_api_key(settings, provider)
        scanned_mode = (doc.extraction_method if doc.extraction_method in ("ai_vision", "ocr", "skip")
                        else settings.scanned_mode or "skip")

        file_rec = frappe.get_all("File", filters={"file_url": doc.source_file}, fields=["name"])
        if not file_rec:
            frappe.throw(f"File record not found for {doc.source_file}")
        file_path = frappe.get_doc("File", file_rec[0].name).get_full_path()

        text, method = extract_text_with_fallback(
            file_path,
            scanned_mode=scanned_mode,
            scanned_threshold=settings.scanned_char_threshold or 200,
            max_pages=settings.max_pages or 3,
            provider=provider,
            model=model,
            api_key=api_key,
        )

        result, tokens_used = extract_invoice_data(text, provider=provider, model=model, api_key=api_key)

        doc.raw_ai_response = json.dumps(result, indent=2)
        doc.ai_confidence = int((result.get("confidence_score") or 0) * 100)
        doc.provider_used = provider
        doc.model_used = model
        doc.extraction_method = method

        doc.invoice_number = result.get("invoice_number")
        doc.invoice_date = result.get("invoice_date")
        doc.due_date = result.get("due_date")
        doc.currency = result.get("currency")
        doc.subtotal = float(result.get("subtotal") or 0)
        doc.total = float(result.get("total") or 0)

        tax_lines = result.get("tax_lines") or []
        doc.tax_amount = sum(float(t.get("amount") or 0) for t in tax_lines)

        extracted_name = result.get("supplier_name") or ""
        doc.extracted_supplier_name = extracted_name
        supplier, score = match_supplier(extracted_name, threshold=0)
        doc.supplier = supplier
        doc.supplier_match_score = score
        doc.party_type = "Supplier"
        doc.party = supplier

        doc.items = []
        for li in (result.get("line_items") or []):
            desc = li.get("description") or ""
            item_code, item_score = best_item_match(desc, threshold=0)
            doc.append("items", {
                "ai_description": desc,
                "item_code": item_code,
                "item_match_score": item_score,
                "qty": float(li.get("qty") or 1),
                "rate": float(li.get("unit_price") or 0),
                "amount": float(li.get("amount") or 0),
            })

        doc.status = "Pending Validation"
        doc.error_message = ""
        success = 1

    except Exception:
        doc.status = "Failed"
        doc.error_message = frappe.get_traceback()
        frappe.log_error(doc.error_message, f"AI Document Import extraction failed: {import_name}")

    finally:
        doc.save(ignore_permissions=True)
        frappe.db.commit()

        try:
            frappe.get_doc({
                "doctype": "AI Import Log",
                "import_record": import_name,
                "timestamp": frappe.utils.now(),
                "provider": doc.provider_used or "",
                "model": doc.model_used or "",
                "extraction_method": doc.extraction_method or "",
                "tokens_used": tokens_used,
                "success": success,
                "error": doc.error_message or "",
            }).insert(ignore_permissions=True)
            frappe.db.commit()
        except Exception:
            pass


@frappe.whitelist()
def reextract(import_name):
    """Whitelist wrapper so the form JS can trigger re-extraction."""
    frappe.enqueue(
        "erpnext_ai_importer.api.extract.run_extraction",
        queue="long",
        timeout=300,
        import_name=import_name,
    )
    return "Queued"


def _resolve_model(settings, provider):
    return {
        "Claude": settings.claude_model or "claude-haiku-4-5-20251001",
        "OpenAI": settings.openai_model or "gpt-4o-mini",
        "Gemini": settings.gemini_model or "gemini-2.0-flash",
    }.get(provider, "claude-haiku-4-5-20251001")


def _resolve_api_key(settings, provider):
    key_field = {
        "Claude": "claude_api_key",
        "OpenAI": "openai_api_key",
        "Gemini": "gemini_api_key",
    }.get(provider)
    if not key_field:
        return None
    return settings.get_password(key_field)
