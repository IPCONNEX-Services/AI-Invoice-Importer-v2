import os
import tempfile
import frappe
from erpnext_ai_importer.utils.file_detector import detect_file_type, extract_zip_files


@frappe.whitelist()
def upload_invoice(company, provider=None, scanned_mode=None):
    """
    POST endpoint. Expects multipart file in frappe.request.files["file"].
    Creates AI Invoice Import record(s) and enqueues extraction.
    Returns list of created record names.
    """
    if "file" not in frappe.request.files:
        frappe.throw("No file uploaded. Send the file in the 'file' field.")

    uploaded = frappe.request.files["file"]
    filename = uploaded.filename
    content = uploaded.read()

    tmp_dir = tempfile.mkdtemp(prefix="ai_importer_")
    tmp_path = os.path.join(tmp_dir, filename)
    with open(tmp_path, "wb") as f:
        f.write(content)

    file_type = detect_file_type(tmp_path)

    if file_type == "zip":
        file_paths = extract_zip_files(tmp_path, tmp_dir)
    else:
        file_paths = [tmp_path]

    created = []
    for fpath in file_paths:
        rec_name = _create_record(fpath, company, provider, scanned_mode)
        created.append(rec_name)
        frappe.enqueue(
            "erpnext_ai_importer.api.extract.run_extraction",
            queue="long",
            timeout=300,
            import_name=rec_name,
        )

    return created


def _create_record(file_path, company, provider, scanned_mode):
    fname = os.path.basename(file_path)
    ftype = detect_file_type(file_path)

    doc = frappe.new_doc("AI Invoice Import")
    doc.company = company
    doc.file_type = ftype
    doc.status = "Draft"
    if provider:
        doc.provider_used = provider
    if scanned_mode:
        doc.extraction_method = scanned_mode
    doc.insert(ignore_permissions=True)

    with open(file_path, "rb") as f:
        raw = f.read()

    file_doc = frappe.get_doc({
        "doctype": "File",
        "file_name": fname,
        "attached_to_doctype": "AI Invoice Import",
        "attached_to_name": doc.name,
        "attached_to_field": "source_file",
        "content": raw,
        "is_private": 1,
    })
    file_doc.insert(ignore_permissions=True)

    doc.source_file = file_doc.file_url
    doc.save(ignore_permissions=True)
    frappe.db.commit()

    return doc.name
