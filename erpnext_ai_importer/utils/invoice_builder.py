import frappe


def build_purchase_invoice(import_doc):
    """
    Build, insert, and submit a Purchase Invoice from a validated AI Invoice Import doc.
    Returns the new Purchase Invoice name.
    """
    settings = frappe.get_single("AI Import Settings")

    pi = frappe.new_doc("Purchase Invoice")
    pi.supplier = import_doc.supplier
    pi.company = import_doc.company
    pi.bill_no = import_doc.invoice_number
    pi.bill_date = import_doc.invoice_date or frappe.utils.today()
    pi.due_date = import_doc.due_date
    pi.currency = import_doc.currency or frappe.defaults.get_global_default("currency")

    tax_tmpl = import_doc.tax_template or settings.default_tax_template
    if tax_tmpl:
        pi.taxes_and_charges = tax_tmpl
        pi.set_taxes()

    for item in import_doc.items:
        pi.append("items", {
            "item_code": item.item_code,
            "item_name": item.ai_description,
            "qty": item.qty or 1,
            "rate": item.rate or 0,
            "uom": frappe.db.get_value("Item", item.item_code, "stock_uom") or "Unit",
        })

    pi.set_missing_values()
    pi.insert(ignore_permissions=True)
    pi.submit()

    if import_doc.source_file:
        file_docs = frappe.get_all("File", filters={"file_url": import_doc.source_file}, fields=["name"])
        if file_docs:
            src = frappe.get_doc("File", file_docs[0].name)
            new_file = frappe.copy_doc(src)
            new_file.attached_to_doctype = "Purchase Invoice"
            new_file.attached_to_name = pi.name
            new_file.attached_to_field = None
            new_file.insert(ignore_permissions=True)

    return pi.name
