import json
import frappe
import requests
from rapidfuzz import process, fuzz
from bs4 import BeautifulSoup
from erpnext_ai_importer.utils.invoice_builder import build_purchase_invoice


# ---------------------------------------------------------------------------
# Existing: company + supplier fuzzy preview for the validate page
# ---------------------------------------------------------------------------

@frappe.whitelist()
def get_match_preview(import_name):
    """
    Return top fuzzy-match candidates for company and supplier from the
    stored raw AI response. Called by the validate page on load.
    """
    doc = frappe.get_doc("AI Document Import", import_name)

    raw = {}
    try:
        raw = json.loads(doc.raw_ai_response or "{}")
    except Exception:
        pass

    extracted_company = raw.get("our_company") or ""
    extracted_supplier = doc.extracted_supplier_name or raw.get("supplier_name") or ""

    companies = frappe.get_all("Company", fields=["name", "company_name"], filters={"is_group": 0})
    company_choices = {c.name: c.company_name for c in companies}

    suppliers = frappe.get_all("Supplier", fields=["name", "supplier_name"], filters={"disabled": 0})
    supplier_choices = {s.name: s.supplier_name for s in suppliers}

    company_lookup = extracted_company or doc.company or ""
    c_top = (process.extract(company_lookup, company_choices, scorer=fuzz.WRatio, limit=4, score_cutoff=0)
             if company_lookup else [])
    s_top = (process.extract(extracted_supplier, supplier_choices, scorer=fuzz.WRatio, limit=4, score_cutoff=0)
             if extracted_supplier else [])

    current_company_score = 0
    if doc.company and company_choices:
        m = process.extractOne(doc.company, company_choices, scorer=fuzz.WRatio, score_cutoff=0)
        if m:
            current_company_score = round(m[1])

    return {
        "extracted_company": extracted_company,
        "extracted_supplier": extracted_supplier,
        "company_matches": [{"name": k, "display": v, "score": round(s)} for v, s, k in c_top],
        "supplier_matches": [{"name": k, "display": v, "score": round(s)} for v, s, k in s_top],
        "current_company": doc.company or "",
        "current_supplier": doc.supplier or "",
        "current_supplier_score": doc.supplier_match_score or 0,
        "current_company_score": current_company_score,
    }


# ---------------------------------------------------------------------------
# Telecom Invoice Match — IXC /bills on-the-fly matching
# ---------------------------------------------------------------------------

def debug_bills_page():
    """Print raw HTML of first 4 data rows of IXC /bills to understand form structure."""
    from ipconnex_telecom.scripts.ixc_billing import _login
    user = frappe.conf.get("ixc_user")
    pwd  = frappe.conf.get("ixc_pwd")
    host = frappe.conf.get("ixc_host", "https://sip-gw-2.ipconnex.net")
    sess = _login(user, pwd)
    r = sess.get(f"{host}/bills", verify=False, timeout=60)
    soup = BeautifulSoup(r.text, "html5lib")
    main_table = None
    for t in soup.find_all("table"):
        if any("Table" in c for c in (t.get("class") or [])):
            main_table = t
            break
    if not main_table:
        print("NO TABLE FOUND")
        return
    rows = main_table.find_all("tr")
    print(f"Total rows: {len(rows)}")
    for i, row in enumerate(rows[:5]):
        print(f"\n=== ROW {i} ===")
        print(row.prettify()[:3000])


def _apply_ixc_bill(host, bill_id, comment, ai_amount):
    """
    Apply an IXC /bills entry using the imported (PDF) amount, then VERIFY the
    apply took effect by re-fetching /bills. Raises on any failure so the caller
    blocks PI creation.

    Idempotent: if the bill is already applied (no form on /bills), this returns
    successfully without re-applying.
    """
    from ipconnex_telecom.scripts.ixc_billing import _login

    user = frappe.conf.get("ixc_user")
    pwd  = frappe.conf.get("ixc_pwd")
    sess = _login(user, pwd)
    if not sess:
        frappe.throw("IXC login failed — cannot apply the bill. Please try again.")

    UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
          "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")

    def _bill_state():
        """Return ('applied', None), ('unapplied', auth_token), or ('missing', None)."""
        r = sess.get(f"{host}/bills", verify=False, timeout=30, headers={"User-Agent": UA})
        soup = BeautifulSoup(r.text, "html5lib")
        bill_present = any(
            (a.get("href", "") or "").endswith(f"/bills/{bill_id}/edit")
            for a in soup.find_all("a")
        )
        if not bill_present:
            return ("missing", None)
        for form in soup.find_all("form"):
            id_input = form.find("input", {"name": "id"})
            if id_input and id_input.get("value") == str(bill_id):
                tok = form.find("input", {"name": "authenticity_token"})
                return ("unapplied", tok.get("value") if tok else None)
        return ("applied", None)

    state, auth_token = _bill_state()
    if state == "missing":
        frappe.throw(
            f"IXC bill {bill_id} is no longer on /bills — cannot apply. "
            "The Purchase Invoice was NOT created."
        )
    if state == "applied":
        return

    params = {
        "utf8":        "✓",
        "id":          str(bill_id),
        "new_comment": comment or "",
        "new_amount":  f"{ai_amount:.2f}",
    }
    if auth_token:
        params["authenticity_token"] = auth_token

    resp = sess.get(
        f"{host}/bills/apply",
        params=params,
        headers={"Referer": f"{host}/bills", "User-Agent": UA},
        verify=False, timeout=30, allow_redirects=True,
    )

    try:
        with open("/tmp/ixc_apply_debug.txt", "w") as _f:
            _f.write(f"bill_id={bill_id}  amount={ai_amount:.2f}  auth_token={'yes' if auth_token else 'no'}\n")
            _f.write(f"final_url={resp.url}\n")
            _f.write(f"status={resp.status_code}\n\n")
            _f.write(resp.text[:4000])
    except Exception:
        pass

    if resp.status_code not in (200, 302):
        frappe.throw(
            f"IXC apply returned HTTP {resp.status_code}. "
            "The Purchase Invoice was NOT created — please retry or apply manually on IXC."
        )

    # Verify the apply actually took effect — re-fetch /bills and confirm the
    # form is no longer present for this bill_id
    state_after, _ = _bill_state()
    if state_after == "unapplied":
        frappe.throw(
            f"IXC apply did not take effect — bill {bill_id} still shows the apply form on /bills. "
            "The Purchase Invoice was NOT created. Apply the bill manually on IXC, then retry."
        )


def _date_matches(ixc_date_str, target_date):
    """Return True if ixc_date_str parses to the same date as target_date."""
    from frappe.utils import getdate
    try:
        return getdate(ixc_date_str) == target_date
    except Exception:
        return False


def _fetch_ixc_bills(supplier_name):
    """
    Fetch https://sip-gw-2.ipconnex.net/bills and return rows matching
    the given supplier name (fuzzy, score >= 70).

    Returns a list of dicts:
      bill_id, date, payee, comment, amount, frequency
    sorted by date desc.
    """
    from ipconnex_telecom.scripts.ixc_billing import _login

    user = frappe.conf.get("ixc_user")
    pwd  = frappe.conf.get("ixc_pwd")
    host = frappe.conf.get("ixc_host", "https://sip-gw-2.ipconnex.net")

    sess = _login(user, pwd)
    r = sess.get(f"{host}/bills", verify=False, timeout=60)

    soup = BeautifulSoup(r.text, "html5lib")

    main_table = None
    for t in soup.find_all("table"):
        classes = t.get("class") or []
        if any("Table" in c for c in classes):
            main_table = t
            break

    if not main_table:
        return []

    rows = main_table.find_all("tr")
    bills = []

    for row in rows[2:]:  # row 0 = empty, row 1 = headers
        tds = row.find_all(["td", "th"])
        if len(tds) < 7:
            continue

        date_str  = tds[0].get_text(strip=True)
        payee     = tds[1].get_text(strip=True)

        if not payee or not date_str:
            continue

        score = fuzz.WRatio(supplier_name.lower(), payee.lower())
        if score < 70:
            continue

        # Bill ID from the date cell's edit link: /bills/{id}/edit
        bill_id = None
        for a in tds[0].find_all("a"):
            parts = a.get("href", "").split("/")
            if len(parts) >= 3 and parts[1] == "bills" and parts[-1] == "edit":
                bill_id = parts[2]
                break

        # Comment and apply_action from the form in the Comment cell (tds[2])
        comment = ""
        form = tds[2].find("form") if len(tds) > 2 else None
        if form:
            comment_input = form.find("input", {"name": "new_comment"})
            if comment_input:
                comment = comment_input.get("value", "")

        # IXC's default amount from the new_amount input in the Amount/Apply cell (tds[3])
        amount = 0.0
        if len(tds) > 3:
            amt_input = tds[3].find("input", {"name": "new_amount"})
            if amt_input:
                try:
                    amount = float(amt_input.get("value", "0").replace(",", ""))
                except ValueError:
                    pass
        # Fallback: parse "Is paid" cell (tds[6]) → "$ paid / owed"
        if not amount and len(tds) > 6:
            is_paid = tds[6].get_text(strip=True)
            if "/" in is_paid:
                try:
                    amount = float(is_paid.split("/")[-1].strip().replace("$", "").replace(",", "").strip())
                except ValueError:
                    pass

        frequency = tds[4].get_text(strip=True) if len(tds) > 4 else ""

        bills.append({
            "bill_id":   bill_id or "",
            "date":      date_str,
            "payee":     payee,
            "comment":   comment,
            "amount":    amount,
            "frequency": frequency,
        })

    bills.sort(key=lambda x: x["date"], reverse=True)
    return bills[:10]


@frappe.whitelist()
def find_ixc_candidates(import_name):
    """
    For a given AI Document Import, fetch live IXC /bills for the supplier
    and return each bill with the gap % vs the AI-extracted total.
    """
    doc = frappe.get_doc("AI Document Import", import_name)
    if not doc.supplier:
        return {"import": {}, "candidates": []}

    bills = _fetch_ixc_bills(doc.supplier)

    # Filter to bills matching the supplier invoice date (flexible format comparison)
    if doc.invoice_date:
        from frappe.utils import getdate
        try:
            target_date = getdate(doc.invoice_date)
            bills = [b for b in bills if _date_matches(b["date"], target_date)]
        except Exception:
            pass

    ai_total = float(doc.total or 0)
    candidates = []
    for b in bills:
        ixc_total = float(b["amount"])
        if ixc_total:
            gap_pct = abs(ai_total - ixc_total) / ixc_total * 100
        else:
            gap_pct = 100.0
        candidates.append({
            **b,
            "grand_total":     ixc_total,
            "gap_pct":         round(gap_pct, 2),
            "gap_amount":      round(abs(ai_total - ixc_total), 2),
            "auto_approvable": gap_pct < 1.0,
            # synthetic key used by the match page JS
            "name": f"IXC-{b['bill_id']}" if b["bill_id"] else b["date"],
        })

    return {
        "import": {
            "name":               doc.name,
            "supplier":           doc.supplier,
            "total":              ai_total,
            "currency":           doc.currency or "USD",
            "invoice_number":     doc.invoice_number or "",
            "invoice_date":       str(doc.invoice_date or ""),
            "is_telecom_invoice": doc.is_telecom_invoice,
            "status":             doc.status,
        },
        "candidates": candidates,
    }


@frappe.whitelist()
def submit_telecom_invoice(import_name, ixc_bill_id, override_note=None):
    """
    Submit an AI Document Import as a telecom invoice, linking it to the
    selected IXC /bills bill ID. Enforces <1% gap unless override_note given.
    Returns the created Purchase Invoice name and gap info.
    """
    doc = frappe.get_doc("AI Document Import", import_name)

    if doc.status == "Submitted":
        frappe.throw("This import has already been submitted.")
    if doc.status not in ("Pending Validation", "Potential Duplicate"):
        frappe.throw(f"Cannot submit an import with status '{doc.status}'.")
    if not doc.supplier:
        frappe.throw("Supplier is required before submitting.")
    if not ixc_bill_id:
        frappe.throw("An IXC bill must be selected.")

    # Re-fetch the bill to get current amount and verify gap
    bills = _fetch_ixc_bills(doc.supplier)
    matched = next((b for b in bills if b["bill_id"] == str(ixc_bill_id)), None)
    if not matched:
        frappe.throw(f"IXC bill {ixc_bill_id} not found for supplier {doc.supplier}. "
                     "It may have already been paid or the period changed.")

    ai_total  = float(doc.total or 0)
    ixc_total = float(matched["amount"])
    gap_pct   = abs(ai_total - ixc_total) / ixc_total * 100 if ixc_total else 100.0

    if gap_pct >= 1.0 and not override_note:
        frappe.throw(
            f"Gap is {gap_pct:.2f}% (threshold: 1%). "
            "Provide an override note to submit anyway."
        )

    # Apply on IXC first — if this fails the bill stays open and no PI is created
    if not matched.get("bill_id"):
        frappe.throw(
            "IXC bill ID not found for this bill. "
            "Refresh the page and try again."
        )
    host = frappe.conf.get("ixc_host", "https://sip-gw-2.ipconnex.net")
    # Use the imported (PDF) amount — this is what we're paying per the supplier invoice
    _apply_ixc_bill(host, matched["bill_id"], matched.get("comment", ""), ai_total)

    # If the AI didn't extract an invoice date, use the IXC bill's date
    if not doc.invoice_date and matched.get("date"):
        doc.invoice_date = matched["date"]

    # IXC confirmed — now create the Purchase Invoice
    pi_name = build_purchase_invoice(doc)

    # Record the IXC bill reference on the PI
    ixc_ref = (f"IXC /bills ref: {ixc_bill_id} | {matched['payee']} | "
               f"{matched['date']} | ${ixc_total:.2f} | gap {gap_pct:.2f}%")
    if override_note:
        ixc_ref += f" | Override: {override_note}"
    frappe.db.set_value("Purchase Invoice", pi_name, "remarks", ixc_ref)

    doc.ixc_anchor_pi = ""   # not a PI — clear the Link field
    doc.purchase_invoice = pi_name
    doc.status = "Submitted"
    doc.flags.ignore_mandatory = True
    doc.save(ignore_permissions=True)
    frappe.db.commit()

    return {
        "purchase_invoice": pi_name,
        "ixc_bill_id":      ixc_bill_id,
        "ixc_total":        ixc_total,
        "gap_pct":          round(gap_pct, 2),
        "auto_approved":    gap_pct < 1.0,
    }
