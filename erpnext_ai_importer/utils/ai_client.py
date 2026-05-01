import json

EXTRACTION_PROMPT = """Extract invoice data from the following supplier invoice text.
Return ONLY valid JSON matching exactly this schema. Use null for any field you cannot determine.

{
  "invoice_number": "string or null",
  "invoice_date": "YYYY-MM-DD string or null",
  "due_date": "YYYY-MM-DD string or null",
  "currency": "3-letter ISO code or null",
  "supplier_name": "string or null",
  "subtotal": "number or null",
  "tax_lines": [{"name": "string", "rate": "number", "amount": "number"}],
  "total": "number or null",
  "line_items": [{"description": "string", "qty": "number", "unit_price": "number", "amount": "number"}],
  "confidence_score": "number between 0 and 1"
}

Invoice text:
"""

MAX_TOKENS = 2048


def _build_prompt(text):
    return EXTRACTION_PROMPT + text


def _parse_json(raw):
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        import frappe
        frappe.throw(f"AI returned invalid JSON: {e}. Raw response (truncated): {raw[:200]}")


def extract_invoice_data(text, provider, model, api_key):
    """Call AI provider and return parsed dict."""
    prompt = _build_prompt(text)
    if provider == "Claude":
        return _call_claude(prompt, model, api_key)
    elif provider == "OpenAI":
        return _call_openai(prompt, model, api_key)
    elif provider == "Gemini":
        return _call_gemini(prompt, model, api_key)
    else:
        import frappe
        frappe.throw(f"Unknown AI provider: {provider}")


def _call_claude(prompt, model, api_key):
    import anthropic
    try:
        client = anthropic.Anthropic(api_key=api_key)
        msg = client.messages.create(
            model=model,
            max_tokens=MAX_TOKENS,
            messages=[{"role": "user", "content": prompt}],
        )
        return _parse_json(msg.content[0].text)
    except anthropic.APIError as e:
        import frappe
        frappe.throw(f"Claude API error: {e}")


def _call_openai(prompt, model, api_key):
    from openai import OpenAI, OpenAIError
    try:
        client = OpenAI(api_key=api_key)
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=MAX_TOKENS,
        )
        return _parse_json(resp.choices[0].message.content)
    except OpenAIError as e:
        import frappe
        frappe.throw(f"OpenAI API error: {e}")


def _call_gemini(prompt, model, api_key):
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        m = genai.GenerativeModel(model)
        resp = m.generate_content(prompt)
        return _parse_json(resp.text)
    except Exception as e:
        import frappe
        frappe.throw(f"Gemini API error: {e}")
