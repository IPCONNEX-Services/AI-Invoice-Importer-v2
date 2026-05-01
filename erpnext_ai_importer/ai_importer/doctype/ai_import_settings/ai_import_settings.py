import frappe
from frappe.model.document import Document


class AIImportSettings(Document):
    pass


def get_settings():
    return frappe.get_single("AI Import Settings")
