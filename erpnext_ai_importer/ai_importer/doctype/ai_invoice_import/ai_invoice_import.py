import frappe
from frappe.model.document import Document


class AIInvoiceImport(Document):
    def before_save(self):
        if self.status == "Submitted" and self.get_db_value("status") == "Submitted":
            if not frappe.flags.in_test:
                frappe.throw("Cannot modify a submitted AI Invoice Import.")
