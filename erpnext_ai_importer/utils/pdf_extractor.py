import io
import base64


def extract_text_from_pdf(file_path, max_pages=3):
    """Extract text using pdfplumber. Returns (text, "pdfplumber")."""
    import pdfplumber
    with pdfplumber.open(file_path) as pdf:
        pages = pdf.pages[:max_pages]
        text = "\n".join(p.extract_text() or "" for p in pages)
    return text.strip(), "pdfplumber"


def extract_text_with_fallback(file_path, scanned_mode, scanned_threshold,
                               max_pages=3, provider=None, model=None, api_key=None):
    """
    Try pdfplumber first. If text < scanned_threshold chars, apply scanned fallback.
    Returns (text, method_name).
    Raises frappe.ValidationError when scanned_mode == "skip".
    """
    text, method = extract_text_from_pdf(file_path, max_pages)

    if len(text) >= (scanned_threshold or 200):
        return text, method

    if scanned_mode == "skip":
        import frappe
        frappe.throw(
            "Scanned PDF detected (less than {} chars extracted). "
            "Change Scanned PDF Handling in AI Import Settings to process it.".format(scanned_threshold)
        )

    if scanned_mode == "ocr":
        return _ocr_pdf(file_path, max_pages), "ocr"

    if scanned_mode == "ai_vision":
        return _vision_pdf(file_path, max_pages, provider, model, api_key), "ai_vision"

    return text, method


def _ocr_pdf(file_path, max_pages):
    from pdf2image import convert_from_path
    import pytesseract
    images = convert_from_path(file_path, last_page=max_pages)
    return "\n".join(pytesseract.image_to_string(img) for img in images)


def _vision_pdf(file_path, max_pages, provider, model, api_key):
    from pdf2image import convert_from_path
    images = convert_from_path(file_path, last_page=max_pages)
    encoded = []
    for img in images:
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        encoded.append(base64.b64encode(buf.getvalue()).decode())

    if provider == "Claude":
        return _vision_claude(encoded, model, api_key)
    elif provider == "OpenAI":
        return _vision_openai(encoded, model, api_key)
    else:
        return _ocr_pdf(file_path, max_pages)


def _vision_claude(images_b64, model, api_key):
    import anthropic
    client = anthropic.Anthropic(api_key=api_key)
    content = []
    for img in images_b64:
        content.append({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": img}})
    content.append({"type": "text", "text": "Extract all text from this invoice image. Return only the raw text, no commentary."})
    msg = client.messages.create(model=model, max_tokens=2048, messages=[{"role": "user", "content": content}])
    return msg.content[0].text


def _vision_openai(images_b64, model, api_key):
    from openai import OpenAI
    client = OpenAI(api_key=api_key)
    content = [{"type": "text", "text": "Extract all text from this invoice image. Return only the raw text, no commentary."}]
    for img in images_b64:
        content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img}"}})
    resp = client.chat.completions.create(model=model, messages=[{"role": "user", "content": content}], max_tokens=2048)
    return resp.choices[0].message.content
