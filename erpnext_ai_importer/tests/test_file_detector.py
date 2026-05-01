import os, tempfile, zipfile, pytest
from erpnext_ai_importer.utils.file_detector import detect_file_type, extract_zip_files


def _make_tmp(suffix, content=b""):
    f = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    f.write(content)
    f.close()
    return f.name


def test_detect_pdf():
    p = _make_tmp(".pdf", b"%PDF-1.4 fake content")
    assert detect_file_type(p) == "pdf"
    os.unlink(p)


def test_detect_xlsx():
    # xlsx magic bytes: PK\x03\x04
    p = _make_tmp(".xlsx", b"PK\x03\x04fake xlsx content")
    assert detect_file_type(p) == "excel"
    os.unlink(p)


def test_detect_csv():
    p = _make_tmp(".csv", b"col1,col2\nval1,val2")
    assert detect_file_type(p) == "csv"
    os.unlink(p)


def test_detect_zip():
    tmp_dir = tempfile.mkdtemp()
    zip_path = os.path.join(tmp_dir, "batch.zip")
    pdf_path = os.path.join(tmp_dir, "a.pdf")
    with open(pdf_path, "wb") as f:
        f.write(b"%PDF-1.4 fake")
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.write(pdf_path, "a.pdf")
    assert detect_file_type(zip_path) == "zip"


def test_extract_zip_returns_supported_files():
    tmp_dir = tempfile.mkdtemp()
    zip_path = os.path.join(tmp_dir, "batch.zip")
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("invoice.pdf", b"%PDF-1.4")
        zf.writestr("notes.txt", b"ignore me")
        zf.writestr("__MACOSX/._invoice.pdf", b"skip")
    out_dir = tempfile.mkdtemp()
    files = extract_zip_files(zip_path, out_dir)
    assert len(files) == 1
    assert files[0].endswith("invoice.pdf")


def test_unsupported_raises():
    p = _make_tmp(".docx", b"PK\x03\x04fake docx")
    with pytest.raises(ValueError, match="Unsupported"):
        detect_file_type(p)
    os.unlink(p)
