import frappe


def execute():
    """
    Pre-model-sync: rename the two DocTypes so bench migrate finds
    the existing table when syncing the new AI Document Import JSON.
    Idempotent — safe to re-run.
    """
    if frappe.db.exists("DocType", "AI Invoice Import"):
        frappe.rename_doc("DocType", "AI Invoice Import", "AI Document Import", force=True)

    if frappe.db.exists("DocType", "AI Invoice Import Item"):
        frappe.rename_doc("DocType", "AI Invoice Import Item", "AI Document Import Item", force=True)
