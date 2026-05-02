from rapidfuzz import process, fuzz


def _fuzzy_match_from_choices(name, choices, threshold=0):
    """
    choices: dict of {docname: display_name}
    Returns (docname, score) or (None, 0).
    Passing the dict directly to rapidfuzz gives us the key back, avoiding reverse-lookup.
    """
    if not name or not choices:
        return None, 0
    result = process.extractOne(
        name, choices, scorer=fuzz.WRatio, score_cutoff=threshold
    )
    if not result:
        return None, 0
    _display, score, docname = result
    return docname, round(score)


def _fuzzy_top_matches_from_choices(name, choices, limit=5, threshold=0):
    """Returns list of {"docname", "display_name", "score"} sorted by score desc."""
    if not name or not choices:
        return []
    results = process.extract(
        name, choices, scorer=fuzz.WRatio, limit=limit, score_cutoff=threshold
    )
    out = [
        {"docname": docname, "display_name": display, "score": round(score)}
        for display, score, docname in results
    ]
    return sorted(out, key=lambda x: x["score"], reverse=True)


def match_company(name, threshold=0):
    """Return (company_docname, score). Matches extracted company name against Frappe Company list."""
    import frappe
    companies = frappe.get_all("Company", fields=["name", "company_name"], filters={"is_group": 0})
    choices = {c.name: c.company_name for c in companies}
    return _fuzzy_match_from_choices(name, choices, threshold)


def match_supplier(name, threshold=0):
    """Return (supplier_docname, score). Queries live ERPNext Supplier table."""
    import frappe
    suppliers = frappe.get_all("Supplier", fields=["name", "supplier_name"], filters={"disabled": 0})
    choices = {s.name: s.supplier_name for s in suppliers}
    return _fuzzy_match_from_choices(name, choices, threshold)


def match_item(description, limit=5, threshold=0):
    """Return top item matches as list of {"item_code", "item_name", "score"}."""
    import frappe
    items = frappe.get_all("Item", fields=["name", "item_name"], filters={"disabled": 0})
    choices = {i.name: i.item_name for i in items}
    raw = _fuzzy_top_matches_from_choices(description, choices, limit=limit, threshold=threshold)
    return [{"item_code": r["docname"], "item_name": r["display_name"], "score": r["score"]} for r in raw]


def best_item_match(description, threshold=0):
    """Return (item_code, score) for the single best match."""
    matches = match_item(description, limit=1, threshold=threshold)
    if matches:
        return matches[0]["item_code"], matches[0]["score"]
    return None, 0
