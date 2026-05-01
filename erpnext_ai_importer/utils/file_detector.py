import os
import zipfile
import mimetypes

SUPPORTED = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "excel",
    "application/vnd.ms-excel": "excel",
    "text/csv": "csv",
    "application/zip": "zip",
    "application/x-zip-compressed": "zip",
}


def detect_file_type(file_path):
    mime, _ = mimetypes.guess_type(file_path)
    if not mime:
        mime = _sniff_mime(file_path)
    file_type = SUPPORTED.get(mime)
    if not file_type:
        raise ValueError(f"Unsupported file type: {mime or 'unknown'} for {os.path.basename(file_path)}")
    return file_type


def _sniff_mime(file_path):
    with open(file_path, "rb") as f:
        header = f.read(8)
    if header[:4] == b"%PDF":
        return "application/pdf"
    if header[:4] == b"PK\x03\x04":
        ext = os.path.splitext(file_path)[1].lower()
        if ext in (".xlsx", ".xls"):
            return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        if ext == ".docx":
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        return "application/zip"
    if file_path.endswith(".csv"):
        return "text/csv"
    return None


def extract_zip_files(zip_path, extract_to):
    extracted = []
    with zipfile.ZipFile(zip_path, "r") as zf:
        for name in zf.namelist():
            if name.startswith("__MACOSX") or name.endswith("/"):
                continue
            ext = os.path.splitext(name)[1].lower()
            if ext in (".pdf", ".xlsx", ".xls", ".csv"):
                dest = zf.extract(name, extract_to)
                extracted.append(dest)
    return extracted
