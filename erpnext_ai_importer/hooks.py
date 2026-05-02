app_name = "erpnext_ai_importer"
app_title = "Supplier Invoice Importer"
app_publisher = "IPCONNEX"
app_description = "AI-powered supplier invoice import for ERPNext"
app_email = "dev@ipconnex.com"
app_license = "MIT"
app_version = "1.0.0"

required_apps = ["frappe", "erpnext"]

doctype_js = {
    "AI Invoice Import": "public/js/ai_invoice_import.js"
}

fixtures = [
    {"doctype": "Workspace", "filters": [["module", "=", "Ai Importer"]]},
    {"doctype": "Custom HTML Block", "filters": [["name", "in", ["ai-invoice-importer"]]]},
]
