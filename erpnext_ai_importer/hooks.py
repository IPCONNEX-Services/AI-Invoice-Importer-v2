app_name = "erpnext_ai_importer"
app_title = "AI Document Importer"
app_publisher = "IPCONNEX"
app_description = "AI-powered document import for ERPNext — Purchase Invoice, Quotation, Sales Order, Payment Entry"
app_email = "dev@ipconnex.com"
app_license = "MIT"
app_version = "1.0.0"

required_apps = ["frappe", "erpnext"]

doctype_js = {
    "AI Document Import": "public/js/ai_invoice_import.js"
}

fixtures = [
    {"doctype": "Workspace", "filters": [["module", "=", "Ai Importer"]]},
    {"doctype": "Custom HTML Block", "filters": [["name", "in", ["ai-invoice-importer"]]]},
]
