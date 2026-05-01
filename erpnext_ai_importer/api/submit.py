import frappe
from erpnext_ai_importer.utils.invoice_builder import build_purchase_invoice


@frappe.whitelist()
def create_purchase_invoice(import_name):
    """
    Validates the AI Invoice Import record and creates a Purchase Invoice.
    Called from the form JS after user confirmation.
    Returns the new Purchase Invoice name.
    """
    doc = frappe.get_doc("AI Invoice Import", import_name)

    if doc.status == "Submitted":
        frappe.throw("This import has already been submitted.")

    if doc.status != "Pending Validation":
        frappe.throw(f"Cannot submit an import with status '{doc.status}'. It must be 'Pending Validation'.")

    if not doc.supplier:
        frappe.throw("Supplier is required before creating an invoice.")

    settings = frappe.get_single("AI Import Settings")
    low_threshold = settings.supplier_low_confidence or 60
    if (doc.supplier_match_score or 0) < low_threshold:
        frappe.throw(
            f"Supplier confidence ({doc.supplier_match_score}%) is below the minimum threshold "
            f"({low_threshold}%). Manually verify and update the supplier field."
        )

    unmapped = [i.ai_description for i in doc.items if not i.item_code]
    if unmapped:
        frappe.throw(f"The following items are not mapped: {', '.join(unmapped)}. "
                     "Select an existing item or create a new one for each row.")

    dup_mode = settings.duplicate_detection or "warn"
    if dup_mode != "disabled" and doc.invoice_number:
        existing = frappe.db.exists("Purchase Invoice", {
            "bill_no": doc.invoice_number,
            "supplier": doc.supplier,
            "docstatus": ["!=", 2],
        })
        if existing:
            msg = (f"Duplicate detected: Purchase Invoice {existing} already exists "
                   f"for supplier {doc.supplier} with invoice number {doc.invoice_number}.")
            if dup_mode == "block":
                frappe.throw(msg)
            else:
                frappe.msgprint(msg, alert=True)

    pi_name = build_purchase_invoice(doc)

    doc.purchase_invoice = pi_name
    doc.status = "Submitted"
    doc.save(ignore_permissions=True)
    frappe.db.commit()

    return pi_name
