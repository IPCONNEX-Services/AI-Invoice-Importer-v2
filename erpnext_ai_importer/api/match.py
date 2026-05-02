import json
import frappe
from rapidfuzz import process, fuzz


@frappe.whitelist()
def get_match_preview(import_name):
    """
    Return top fuzzy-match candidates for company and supplier from the
    stored raw AI response. Called by the validate page on load.
    """
    doc = frappe.get_doc("AI Document Import", import_name)

    raw = {}
    try:
        raw = json.loads(doc.raw_ai_response or "{}")
    except Exception:
        pass

    extracted_company = raw.get("our_company") or ""
    extracted_supplier = doc.extracted_supplier_name or raw.get("supplier_name") or ""

    companies = frappe.get_all("Company", fields=["name", "company_name"], filters={"is_group": 0})
    company_choices = {c.name: c.company_name for c in companies}

    suppliers = frappe.get_all("Supplier", fields=["name", "supplier_name"], filters={"disabled": 0})
    supplier_choices = {s.name: s.supplier_name for s in suppliers}

    # Use current company as lookup text when AI didn't extract one yet
    company_lookup = extracted_company or doc.company or ""
    c_top = (process.extract(company_lookup, company_choices, scorer=fuzz.WRatio, limit=4, score_cutoff=0)
             if company_lookup else [])
    s_top = (process.extract(extracted_supplier, supplier_choices, scorer=fuzz.WRatio, limit=4, score_cutoff=0)
             if extracted_supplier else [])

    # Score for the currently saved company value
    current_company_score = 0
    if doc.company and company_choices:
        m = process.extractOne(doc.company, company_choices, scorer=fuzz.WRatio, score_cutoff=0)
        if m:
            current_company_score = round(m[1])

    return {
        "extracted_company": extracted_company,
        "extracted_supplier": extracted_supplier,
        "company_matches": [{"name": k, "display": v, "score": round(s)} for v, s, k in c_top],
        "supplier_matches": [{"name": k, "display": v, "score": round(s)} for v, s, k in s_top],
        "current_company": doc.company or "",
        "current_supplier": doc.supplier or "",
        "current_supplier_score": doc.supplier_match_score or 0,
        "current_company_score": current_company_score,
    }
