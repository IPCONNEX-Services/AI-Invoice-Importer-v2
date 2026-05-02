frappe.pages["ai-invoice-validate"].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: "Document Import — Review",
		single_column: true,
	});

	// ── IPCONNEX Design System ────────────────────────────────────────────────
	frappe.dom.set_style(`
		.aiv-root {
			--blue:#0B70E1; --blue-dk:#0958B3; --blue-lt:#E8F2FF;
			--navy:#0B1D3A; --border:#D8E4F0; --bg:#F4F7FB; --surface:#FFFFFF;
			--text:#0B1D3A; --text-sub:#5A7A9A; --text-muted:#9BB5CC;
			--ok:#0D7C3D; --ok-bg:#EAF7EE; --ok-bd:#A7D7BA;
			--err:#C7201A; --err-bg:#FDECEA; --err-bd:#F5AAAA;
			--warn:#A85A00; --warn-bg:#FFF3E0; --warn-bd:#F8D08A;
			--r-sm:6px; --r-md:10px; --r-lg:14px;
			--sh-sm:0 1px 4px rgba(11,29,58,.07);
			--sh-md:0 4px 16px rgba(11,29,58,.10);
			max-width:none; margin:0; padding:20px 16px 60px;
			font-family:'Inter','Segoe UI',-apple-system,sans-serif;
		}
		.aiv-header {
			display:grid; grid-template-columns:3fr 1.2fr 1fr auto; gap:16px;
			padding:14px 20px; background:var(--bg); border:1px solid var(--border);
			border-radius:var(--r-md) var(--r-md) 0 0; border-bottom:none; align-items:start;
		}
		.aiv-card {
			border:1px solid var(--border); border-radius:0 0 var(--r-md) var(--r-md);
			background:var(--surface); box-shadow:var(--sh-sm);
		}
		.aiv-mi-section {
			padding:20px; border-bottom:2px solid var(--border); background:var(--bg);
		}
		.aiv-section { padding:16px 20px; border-bottom:1px solid var(--border); }
		.aiv-section-title {
			font-size:0.7em; font-weight:700; color:var(--text-muted);
			text-transform:uppercase; letter-spacing:0.07em; margin-bottom:14px;
		}
		.aiv-mi-grid { display:grid; grid-template-columns:1fr 1fr; gap:32px; }
		.aiv-meta-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
		.aiv-meta-label {
			font-size:0.72em; font-weight:600; color:var(--text-muted);
			text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px;
		}
		.aiv-meta-val { font-size:0.88em; color:var(--text); }
		.aiv-field-label {
			font-size:0.78em; font-weight:600; color:var(--text);
			margin-bottom:4px; text-transform:uppercase; letter-spacing:0.04em;
		}
		.aiv-input {
			width:100%; border:1px solid var(--border); border-radius:var(--r-sm);
			padding:7px 10px; background:var(--surface); box-sizing:border-box;
			font-size:0.9em; font-family:inherit; color:var(--text);
		}
		.aiv-input:focus { outline:none; border-color:var(--blue); box-shadow:0 0 0 3px rgba(11,112,225,.12); }
		.aiv-match-label {
			font-size:0.72em; font-weight:700; color:var(--text);
			text-transform:uppercase; letter-spacing:0.06em; margin-bottom:6px;
		}
		.aiv-match-extracted { font-size:0.75em; color:var(--text-muted); margin-bottom:8px; }
		.aiv-match-row { display:flex; align-items:stretch; gap:8px; margin-bottom:8px; }
		.aiv-match-input-wrap { position:relative; flex:1; }
		.aiv-match-input {
			width:100%; border-radius:var(--r-sm); padding:8px 12px; box-sizing:border-box;
			font-size:0.9em; font-weight:500; font-family:inherit; outline:none;
		}
		.aiv-match-input.ok  { border:2px solid var(--ok-bd);  background:var(--ok-bg);  color:var(--text); }
		.aiv-match-input.warn{ border:2px solid var(--warn-bd); background:var(--warn-bg); color:var(--text); }
		.aiv-match-input.err { border:2px solid var(--err-bd);  background:var(--err-bg);  color:var(--text); }
		.aiv-match-input.neu { border:2px solid var(--border);  background:var(--bg);      color:var(--text); }
		.aiv-score-chip {
			display:flex; align-items:center; padding:0 12px; border-radius:var(--r-sm);
			font-size:0.9em; font-weight:700; white-space:nowrap; min-width:52px;
			justify-content:center;
		}
		.aiv-score-chip.ok  { background:var(--ok-bg);  border:2px solid var(--ok-bd);  color:var(--ok); }
		.aiv-score-chip.warn{ background:var(--warn-bg); border:2px solid var(--warn-bd); color:var(--warn); }
		.aiv-score-chip.err { background:var(--err-bg);  border:2px solid var(--err-bd);  color:var(--err); }
		.aiv-suggestions {
			display:none; position:absolute; top:100%; left:0; right:0; margin-top:2px;
			background:var(--surface); border:1px solid var(--border); border-radius:var(--r-sm);
			box-shadow:var(--sh-md); z-index:200; max-height:200px; overflow-y:auto; font-size:0.85em;
		}
		.aiv-suggestion-item {
			padding:8px 12px; cursor:pointer; border-bottom:1px solid var(--bg); color:var(--text);
		}
		.aiv-suggestion-item:hover { background:var(--blue-lt); color:var(--blue-dk); }
		.aiv-alts { display:flex; flex-wrap:wrap; gap:4px; align-items:center; }
		.aiv-pill {
			font-size:0.74em; padding:3px 9px; border:1px solid var(--border);
			border-radius:12px; background:var(--bg); color:var(--text-sub);
			cursor:pointer; white-space:nowrap;
		}
		.aiv-pill:hover { border-color:var(--blue); color:var(--blue); }
		.aiv-pill-score { color:var(--text-muted); margin-left:3px; }
		.aiv-table { width:100%; border-collapse:collapse; font-size:0.83em; }
		.aiv-table thead th {
			padding:7px 10px; border:1px solid var(--border);
			color:var(--text-sub); font-weight:500; background:var(--bg); text-align:left;
		}
		.aiv-table thead th.center { text-align:center; width:60px; }
		.aiv-table thead th.right  { text-align:right;  width:90px; }
		.aiv-table thead th.qty    { text-align:right;  width:60px; }
		.aiv-table tbody td { padding:7px 10px; border:1px solid var(--border); color:var(--text); vertical-align:middle; }
		.aiv-table tbody td.center { text-align:center; }
		.aiv-table tbody td.right  { text-align:right; }
		.aiv-row-warn { background:var(--warn-bg); }
		.aiv-badge { display:inline-block; padding:4px 12px; border-radius:var(--r-sm); font-size:0.82em; font-weight:600; }
		.aiv-badge-draft      { background:#f1f5f9; color:var(--text-sub); }
		.aiv-badge-extracting { background:var(--blue-lt); color:var(--blue-dk); }
		.aiv-badge-pending    { background:var(--warn-bg); color:var(--warn); }
		.aiv-badge-duplicate  { background:var(--err-bg);  color:var(--err);  }
		.aiv-badge-submitted  { background:var(--ok-bg);   color:var(--ok);   }
		.aiv-badge-failed     { background:var(--err-bg);  color:var(--err);  }
		.aiv-action-bar {
			padding:14px 16px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;
		}
		.aiv-btn-primary {
			background:var(--blue); color:#fff; border:none; border-radius:var(--r-sm);
			padding:9px 18px; font-size:0.9em; cursor:pointer; font-weight:500; font-family:inherit;
		}
		.aiv-btn-primary:disabled { background:var(--text-muted); cursor:not-allowed; }
		.aiv-btn-primary.err { background:var(--err); }
		.aiv-btn-secondary {
			background:var(--surface); border:1px solid var(--border); color:var(--text);
			border-radius:var(--r-sm); padding:9px 14px; font-size:0.9em; cursor:pointer; font-family:inherit;
		}
		.aiv-btn-create {
			font-size:0.72em; padding:2px 8px; border:1px solid var(--blue);
			border-radius:var(--r-sm); background:var(--surface); color:var(--blue);
			cursor:pointer; white-space:nowrap;
		}
		.aiv-item-input {
			width:100%; border:1px solid var(--warn-bd); border-radius:3px; padding:4px 6px;
			background:var(--surface); box-sizing:border-box; font-size:0.85em; font-family:inherit; color:var(--text);
		}
		.aiv-item-suggestions {
			display:none; position:absolute; top:100%; left:0; right:0;
			background:var(--surface); border:1px solid var(--border); border-radius:var(--r-sm);
			box-shadow:var(--sh-sm); z-index:100; max-height:160px; overflow-y:auto; font-size:0.85em;
		}
		.aiv-item-option {
			padding:6px 10px; cursor:pointer; border-bottom:1px solid var(--bg); color:var(--text);
		}
		.aiv-item-option:hover { background:var(--blue-lt); }
		.aiv-link { color:var(--blue); text-decoration:none; }
		.aiv-link:hover { text-decoration:underline; }
		.aiv-back-link { margin-left:auto; font-size:0.85em; color:var(--text-sub); text-decoration:none; }
		.aiv-back-link:hover { color:var(--blue); }
		.aiv-warn-text { font-size:0.82em; color:var(--warn); }
		.aiv-doc-name { font-size:0.72em; color:var(--text-muted); margin-top:4px; display:block; }
		.aiv-totals-row { font-size:0.85em; color:var(--text-sub); }
		.aiv-totals-row + .aiv-totals-row { margin-top:2px; }
		.aiv-grand-total { font-size:1.2em; font-weight:700; margin-top:8px; color:var(--text); }
		.aiv-conf-ok   { color:var(--ok);   font-weight:600; font-size:1.1em; }
		.aiv-conf-warn { color:var(--warn);  font-weight:600; font-size:1.1em; }
		.aiv-conf-err  { color:var(--err);   font-weight:600; font-size:1.1em; }
		.aiv-dup-banner {
			display:flex; align-items:flex-start; gap:10px;
			margin-bottom:12px; padding:12px 16px; border-radius:var(--r-md);
			background:var(--err-bg); border:1px solid var(--err-bd);
			font-size:0.85em; color:var(--err); line-height:1.5;
		}
		.aiv-dup-icon { font-size:1.2em; flex-shrink:0; margin-top:1px; }
		.aiv-dup-links a { color:var(--err); font-weight:600; text-decoration:underline; }
		.aiv-tax-chip {
			display:inline-block; background:var(--ok-bg); border:1px solid var(--ok-bd);
			padding:4px 10px; border-radius:var(--r-sm); font-size:0.85em; margin-bottom:6px;
		}
		.aiv-model-sub { font-size:0.78em; color:var(--text-muted); }
	`);

	const route = frappe.get_route();
	const name = route && route[1] ? decodeURIComponent(route[1]) : null;
	if (!name) {
		$(wrapper).find(".page-content").html(
			`<div style="padding:48px;text-align:center;color:var(--err,#C7201A)">
				No import name specified.
				<a class="aiv-link" href="/app/ai-importer">← Back to Importer</a>
			</div>`
		);
		return;
	}

	frappe.ai_validate_page = new AiValidatePage(page, wrapper, name);
};

frappe.pages["ai-invoice-validate"].on_page_show = function (wrapper) {
	const route = frappe.get_route();
	const name = route && route[1] ? decodeURIComponent(route[1]) : null;
	if (!name) return;
	if (!frappe.ai_validate_page || frappe.ai_validate_page.name !== name) {
		if (frappe.ai_validate_page) {
			frappe.ai_validate_page.name = name;
			frappe.ai_validate_page.doc = null;
			frappe.ai_validate_page.match_preview = null;
			frappe.ai_validate_page._load();
		}
	}
};

class AiValidatePage {
	constructor(page, wrapper, name) {
		this.page = page;
		this.wrapper = wrapper;
		this.name = name;
		this.doc = null;
		this.settings = null;
		this.match_preview = null;
		this._load();
	}

	_load() {
		Promise.all([
			frappe.call({ method: "frappe.client.get", args: { doctype: "AI Document Import", name: this.name } }),
			frappe.call({ method: "frappe.client.get", args: { doctype: "AI Import Settings", name: "AI Import Settings" } }),
			frappe.call({ method: "erpnext_ai_importer.api.match.get_match_preview", args: { import_name: this.name } }),
		]).then(([doc_r, settings_r, preview_r]) => {
			this.doc = doc_r.message;
			this.settings = settings_r.message || {};
			this.match_preview = preview_r.message || {};
			if (!this.doc) {
				$(this.wrapper).find(".page-content").html(
					`<div style="padding:48px;text-align:center" class="aiv-conf-err">Import record "${this.name}" not found.</div>`
				);
				return;
			}
			this.page.set_title(`Review — ${this.name}`);
			this._render();
			this._check_duplicates();
		});
	}

	_render() {
		const d = this.doc;
		const s = this.settings;
		const mp = this.match_preview || {};
		const low_threshold = s.supplier_low_confidence || 60;
		const item_threshold = s.item_match_threshold || 70;

		const conf_class = d.ai_confidence >= 80 ? "aiv-conf-ok" : d.ai_confidence >= 50 ? "aiv-conf-warn" : "aiv-conf-err";
		const ai_conf = d.ai_confidence ? `${Math.round(d.ai_confidence)}%` : "—";

		const items_html = (d.items || []).map((item) => this._item_row_html(item, item_threshold)).join("");
		const tax_html = this._tax_html(d);
		const status_badge = this._status_badge(d.status);
		const unmapped_count = (d.items || []).filter(i => !i.item_code).length;
		const supplier_score = mp.current_supplier_score != null ? mp.current_supplier_score : (d.supplier_match_score || 0);
		const can_submit = ["Pending Validation", "Potential Duplicate"].includes(d.status) && (mp.current_supplier || d.supplier) && supplier_score >= low_threshold && unmapped_count === 0;

		$(this.wrapper).find(".page-content").html(`
			<div id="ai-validate-root" class="aiv-root">

				<!-- Header bar -->
				<div class="aiv-header">
					${this._meta_field("Source File", this._file_link(d.source_file))}
					${this._meta_field("Method",
						frappe.utils.escape_html(d.extraction_method || "—") +
						(d.model_used ? `<br><span class="aiv-model-sub">${frappe.utils.escape_html(d.model_used)}</span>` : "")
					)}
					${this._meta_field("AI Confidence", `<span class="${conf_class}">${ai_conf}</span>`)}
					<div style="text-align:right">
						${status_badge}
						<span class="aiv-doc-name">${frappe.utils.escape_html(this.name)}</span>
					</div>
				</div>

				<!-- Main card -->
				<div class="aiv-card">

					<!-- Match Intelligence -->
					<div class="aiv-mi-section">
						<div class="aiv-section-title">Match Intelligence</div>
						<div class="aiv-mi-grid">
							${this._match_block_html("company", "Our Company", mp.extracted_company, mp.company_matches || [], mp.current_company || d.company || "", mp.current_company_score != null ? mp.current_company_score : null)}
							${this._match_block_html("supplier", "Supplier / Party", mp.extracted_supplier, mp.supplier_matches || [], mp.current_supplier || d.supplier || "", supplier_score)}
						</div>
					</div>

					<!-- Invoice meta -->
					<div class="aiv-section aiv-meta-grid">
						${this._editable_field("invoice_number", "Doc / Invoice #", d.invoice_number)}
						${this._editable_field("invoice_date", "Date", d.invoice_date, "date")}
						${this._editable_field("due_date", "Due Date", d.due_date, "date")}
						<div>
							<div class="aiv-field-label">Currency</div>
							<div style="font-size:0.9em;padding:7px 0">${frappe.utils.escape_html(d.currency || "—")}</div>
						</div>
					</div>

					<!-- Line items -->
					<div class="aiv-section">
						<div class="aiv-section-title" style="margin-bottom:10px">
							Line Items
							${unmapped_count > 0 ? `<span style="font-size:0.85em;font-weight:400;color:var(--warn);margin-left:8px">⚠ ${unmapped_count} need mapping</span>` : ""}
						</div>
						<table class="aiv-table" id="ai-items-table">
							<thead>
								<tr>
									<th>AI Description</th>
									<th>Matched Item</th>
									<th class="center">Match %</th>
									<th class="qty">Qty</th>
									<th class="right">Rate</th>
									<th class="right">Amount</th>
								</tr>
							</thead>
							<tbody>${items_html}</tbody>
						</table>
					</div>

					<!-- Taxes + Totals -->
					<div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid var(--border)">
						<div style="padding:16px;border-right:1px solid var(--border)">
							<div class="aiv-section-title" style="margin-bottom:8px">Detected Taxes</div>
							${tax_html}
						</div>
						<div style="padding:16px;text-align:right">
							<div class="aiv-totals-row">Subtotal: <strong>${frappe.format(d.subtotal || 0, { fieldtype: "Currency", currency: d.currency })}</strong></div>
							<div class="aiv-totals-row">Taxes: <strong>${frappe.format(d.tax_amount || 0, { fieldtype: "Currency", currency: d.currency })}</strong></div>
							<div class="aiv-grand-total">${frappe.format(d.total || 0, { fieldtype: "Currency", currency: d.currency })}</div>
						</div>
					</div>

					<!-- Action bar -->
					<div class="aiv-action-bar">
						${["Pending Validation", "Potential Duplicate"].includes(d.status) ? `
							<button id="ai-submit-btn" class="aiv-btn-primary" ${can_submit ? "" : "disabled"}>
								✓ Create Purchase Invoice
							</button>
							<button id="ai-reextract-btn" class="aiv-btn-secondary">↺ Re-extract</button>
						` : ""}
						${d.status === "Draft" ? `
							<button id="ai-reextract-btn" class="aiv-btn-primary">⚙ Extract Now</button>
						` : ""}
						${d.status === "Submitted" && d.purchase_invoice ? `
							<a href="${frappe.utils.get_form_link("Purchase Invoice", d.purchase_invoice)}"
								class="aiv-btn-secondary aiv-link" style="text-decoration:none">
								View ${frappe.utils.escape_html(d.purchase_invoice)} →
							</a>
						` : ""}
						<a href="/app/ai-importer" class="aiv-back-link">← Back to Importer</a>
						<span id="ai-submit-warning" class="aiv-warn-text"
							${(unmapped_count > 0 || supplier_score < low_threshold) && ["Pending Validation", "Potential Duplicate"].includes(d.status) ? "" : 'style="display:none"'}>
							${unmapped_count > 0 ? `⚠ ${unmapped_count} item(s) need mapping` : "⚠ Supplier confidence too low — confirm the supplier above"}
						</span>
					</div>

				</div>
			</div>
		`);

		this._bind_events();
	}

	_match_block_html(fieldname, label, extracted, matches, current_val, score) {
		const top_score = score != null ? score : (matches[0] ? matches[0].score : 0);
		const has_score = top_score > 0 || current_val;
		const tier = top_score >= 85 ? "ok" : top_score >= 60 ? "warn" : (current_val ? "err" : "neu");
		const alts = matches.slice(1, 3);

		return `
		<div>
			<div class="aiv-match-label">${label}</div>
			<div class="aiv-match-extracted">
				${extracted
					? `AI extracted: <em>"${frappe.utils.escape_html(extracted)}"</em>`
					: `No text extracted yet`}
			</div>
			<div class="aiv-match-row">
				<div class="aiv-match-input-wrap">
					<input id="ai-${fieldname}-input" type="text"
						class="aiv-match-input ${tier}"
						value="${frappe.utils.escape_html(current_val || "")}"
						placeholder="Search ${frappe.utils.escape_html(label)}…">
					<div id="ai-${fieldname}-suggestions" class="aiv-suggestions"></div>
				</div>
				${has_score ? `<div class="aiv-score-chip ${tier}">${top_score}%</div>` : ""}
			</div>
			${alts.length ? `
			<div class="aiv-alts">
				<span style="font-size:0.7em;margin-right:2px" class="aiv-doc-name">Also:</span>
				${alts.map(a => `
					<button class="aiv-pill ai-alt-pick"
						data-fieldname="${fieldname}"
						data-value="${frappe.utils.escape_html(a.name)}"
						data-display="${frappe.utils.escape_html(a.display)}">
						${frappe.utils.escape_html(a.display)}
						<span class="aiv-pill-score">${a.score}%</span>
					</button>
				`).join("")}
			</div>` : ""}
		</div>`;
	}

	_meta_field(label, value_html) {
		return `<div>
			<div class="aiv-meta-label">${label}</div>
			<div class="aiv-meta-val">${value_html}</div>
		</div>`;
	}

	_editable_field(fieldname, label, value, type) {
		return `<div>
			<div class="aiv-field-label">${label}</div>
			<input data-fieldname="${fieldname}" type="${type || "text"}"
				value="${frappe.utils.escape_html(value || "")}"
				class="aiv-input">
		</div>`;
	}

	_file_link(source_file) {
		if (!source_file) return "—";
		const name = source_file.split("/").pop();
		return `<a href="${source_file}" target="_blank" class="aiv-link">📎 ${frappe.utils.escape_html(name)}</a>`;
	}

	_item_row_html(item, threshold) {
		const score = item.item_match_score || 0;
		const needs_mapping = score < threshold || !item.item_code;
		const score_class = score >= 85 ? "aiv-conf-ok" : score >= threshold ? "aiv-conf-warn" : "aiv-conf-err";

		const matched_cell = needs_mapping ? `
			<div style="display:flex;flex-direction:column;gap:4px">
				<div style="display:flex;align-items:center;gap:6px">
					<span class="aiv-warn-text" style="font-size:0.85em">⚠ ${item.item_code ? "Low match" : "No match"}</span>
					<button class="aiv-btn-create ai-create-item-btn"
						data-row="${frappe.utils.escape_html(item.name)}"
						data-desc="${frappe.utils.escape_html(item.ai_description || "")}">
						+ New Item
					</button>
				</div>
				<div style="position:relative">
					<input type="text" class="aiv-item-input ai-item-input" data-row="${frappe.utils.escape_html(item.name)}"
						value="${frappe.utils.escape_html(item.item_code || "")}"
						placeholder="Search item…">
					<div class="aiv-item-suggestions ai-item-suggestions" data-row="${frappe.utils.escape_html(item.name)}"></div>
				</div>
			</div>
		` : `<span class="aiv-conf-ok">✓ ${frappe.utils.escape_html(item.item_code || "—")}</span>`;

		return `<tr class="${needs_mapping ? "aiv-row-warn" : ""}">
			<td>${frappe.utils.escape_html(item.ai_description || "—")}</td>
			<td>${matched_cell}</td>
			<td class="center"><span class="${score_class}" style="font-weight:600">${score}%</span></td>
			<td class="right">${item.qty || 0}</td>
			<td class="right">${frappe.format(item.rate || 0, { fieldtype: "Currency", currency: this.doc.currency })}</td>
			<td class="right">${frappe.format(item.amount || 0, { fieldtype: "Currency", currency: this.doc.currency })}</td>
		</tr>`;
	}

	_tax_html(d) {
		if (!d.tax_amount || d.tax_amount === 0) {
			return `<div style="font-size:0.85em" class="aiv-doc-name">No tax lines detected</div>`;
		}
		let html = d.tax_template
			? `<div class="aiv-tax-chip">
				${frappe.utils.escape_html(d.tax_template)} → <strong>${frappe.format(d.tax_amount, { fieldtype: "Currency", currency: d.currency })}</strong>
			   </div>`
			: `<div style="font-size:0.85em">Total tax: <strong>${frappe.format(d.tax_amount, { fieldtype: "Currency", currency: d.currency })}</strong></div>`;
		html += `<div style="font-size:0.78em" class="aiv-doc-name">Mapped to tax template on the generated invoice</div>`;
		return html;
	}

	_status_badge(status) {
		const cls = {
			"Draft":               "aiv-badge-draft",
			"Extracting":          "aiv-badge-extracting",
			"Pending Validation":  "aiv-badge-pending",
			"Potential Duplicate": "aiv-badge-duplicate",
			"Submitted":           "aiv-badge-submitted",
			"Failed":              "aiv-badge-failed",
		}[status] || "aiv-badge-draft";
		return `<span class="aiv-badge ${cls}">${status}</span>`;
	}

	_bind_events() {
		const root = $(this.wrapper).find("#ai-validate-root");

		// Company + Supplier autocomplete inputs
		["company", "supplier"].forEach((fieldname) => {
			const doctype = fieldname === "company" ? "Company" : "Supplier";
			const input = root.find(`#ai-${fieldname}-input`);
			const suggestions = root.find(`#ai-${fieldname}-suggestions`);

			input.on("input", frappe.utils.debounce((e) => {
				const txt = e.target.value.trim();
				if (txt.length < 1) { suggestions.hide(); return; }
				frappe.call({
					method: "frappe.desk.search.search_link",
					args: { txt, doctype, ignore_user_permissions: 0 },
				}).then((r) => {
					const results = r.message || [];
					if (!results.length) { suggestions.hide(); return; }
					suggestions.html(results.map((row) =>
						`<div class="aiv-suggestion-item ai-match-option"
							data-fieldname="${fieldname}"
							data-value="${frappe.utils.escape_html(row.value)}">
							${frappe.utils.escape_html(row.value)}
						</div>`
					).join("")).show();
				});
			}, 250));

			suggestions.on("click", ".ai-match-option", (e) => {
				const val = $(e.currentTarget).data("value");
				input.val(val);
				suggestions.hide();
				this._save_match_field(fieldname, val);
			});

			input.on("blur", () => setTimeout(() => suggestions.hide(), 200));
			input.on("keydown", (e) => {
				if (e.key === "Enter") {
					suggestions.hide();
					this._save_match_field(fieldname, input.val().trim());
				}
			});
		});

		// Alt-pick pills
		root.on("click", ".ai-alt-pick", (e) => {
			const btn = $(e.currentTarget);
			const fieldname = btn.data("fieldname");
			const val = String(btn.data("value"));
			const display = String(btn.data("display"));
			root.find(`#ai-${fieldname}-input`).val(display);
			this._save_match_field(fieldname, val);
		});

		// Scalar field edits (invoice_number, invoice_date, due_date)
		root.find("input[data-fieldname]").on("change", (e) => {
			this._save_field($(e.target).data("fieldname"), e.target.value);
		});

		// Item autocomplete
		root.on("input", ".ai-item-input", frappe.utils.debounce((e) => {
			const txt = e.target.value.trim();
			const row_name = $(e.target).data("row");
			const sug = root.find(`.ai-item-suggestions[data-row="${row_name}"]`);
			if (txt.length < 2) { sug.hide(); return; }
			frappe.call({
				method: "frappe.desk.search.search_link",
				args: { txt, doctype: "Item", ignore_user_permissions: 0 },
			}).then((r) => {
				const results = r.message || [];
				if (!results.length) { sug.hide(); return; }
				sug.html(results.map((row) =>
					`<div class="aiv-item-option ai-item-option"
						data-row="${frappe.utils.escape_html(row_name)}"
						data-value="${frappe.utils.escape_html(row.value)}">
						${frappe.utils.escape_html(row.value)}
						${row.description ? `<span class="aiv-pill-score"> — ${frappe.utils.escape_html(row.description)}</span>` : ""}
					</div>`
				).join("")).show();
			});
		}, 300));

		root.on("click", ".ai-item-option", (e) => {
			const row_name = $(e.currentTarget).data("row");
			const val = $(e.currentTarget).data("value");
			root.find(`.ai-item-input[data-row="${row_name}"]`).val(val);
			root.find(`.ai-item-suggestions[data-row="${row_name}"]`).hide();
			this._save_item_field(row_name, "item_code", val);
		});

		root.on("blur", ".ai-item-input", (e) => {
			const row_name = $(e.target).data("row");
			setTimeout(() => root.find(`.ai-item-suggestions[data-row="${row_name}"]`).hide(), 200);
		});

		root.on("keydown", ".ai-item-input", (e) => {
			if (e.key === "Enter") {
				const row_name = $(e.target).data("row");
				root.find(`.ai-item-suggestions[data-row="${row_name}"]`).hide();
				this._save_item_field(row_name, "item_code", e.target.value.trim());
			}
		});

		root.on("click", ".ai-create-item-btn", (e) => {
			const btn = $(e.currentTarget);
			const row_name = String(btn.data("row"));
			const desc = String(btn.data("desc") || "");
			this._open_create_item_dialog(row_name, desc);
		});

		root.find("#ai-submit-btn").on("click", () => this._submit());
		root.find("#ai-reextract-btn").on("click", () => this._reextract());
	}

	_save_match_field(fieldname, value) {
		const updates = { [fieldname]: value };
		if (fieldname === "supplier") {
			updates.supplier_match_score = 100;
			updates.party = value;
		}
		frappe.call({
			method: "frappe.client.set_value",
			args: { doctype: "AI Document Import", name: this.name, fieldname: updates },
		}).then((r) => {
			if (r.message) {
				frappe.show_alert({ message: `${fieldname} updated`, indicator: "green" }, 2);
				Object.assign(this.doc, updates);
				if (this.match_preview) {
					if (fieldname === "supplier") {
						this.match_preview.current_supplier = value;
						this.match_preview.current_supplier_score = 100;
					}
					if (fieldname === "company") {
						this.match_preview.current_company = value;
					}
				}
				this._reload_submit_state();
			}
		});
	}

	_save_field(fieldname, value) {
		frappe.call({
			method: "frappe.client.set_value",
			args: { doctype: "AI Document Import", name: this.name, fieldname: { [fieldname]: value } },
		}).then((r) => {
			if (r.message) {
				frappe.show_alert({ message: `${fieldname} saved`, indicator: "green" }, 2);
				Object.assign(this.doc, { [fieldname]: value });
			}
		});
	}

	_save_item_field(row_name, fieldname, value) {
		frappe.call({
			method: "frappe.client.set_value",
			args: { doctype: "AI Document Import Item", name: row_name, fieldname, value },
		}).then((r) => {
			if (r.message) {
				frappe.show_alert({ message: "Item mapped", indicator: "green" }, 2);
				const item = (this.doc.items || []).find(i => i.name === row_name);
				if (item) { item[fieldname] = value; item.manually_mapped = 1; }
				this._reload_submit_state();
			}
		});
	}

	_reload_submit_state() {
		const d = this.doc;
		const s = this.settings;
		const mp = this.match_preview || {};
		const low_threshold = s.supplier_low_confidence || 60;
		const supplier_score = mp.current_supplier_score != null ? mp.current_supplier_score : (d.supplier_match_score || 0);
		const unmapped_count = (d.items || []).filter(i => !i.item_code).length;
		const can_submit = ["Pending Validation", "Potential Duplicate"].includes(d.status) && (mp.current_supplier || d.supplier) && supplier_score >= low_threshold && unmapped_count === 0;

		const btn = $(this.wrapper).find("#ai-submit-btn");
		btn.css({ background: can_submit ? "var(--blue, #0B70E1)" : "var(--text-muted, #9BB5CC)", cursor: can_submit ? "pointer" : "not-allowed" });
		btn.prop("disabled", !can_submit);

		const warn = $(this.wrapper).find("#ai-submit-warning");
		if (unmapped_count > 0) {
			warn.text(`⚠ ${unmapped_count} item(s) need mapping`).show();
		} else if (!(mp.current_supplier || d.supplier) || supplier_score < low_threshold) {
			warn.text("⚠ Supplier confidence too low — confirm the supplier above").show();
		} else {
			warn.hide();
		}
	}

	_submit() {
		const d = this.doc;
		const s = this.settings;
		const mp = this.match_preview || {};
		const low_threshold = s.supplier_low_confidence || 60;
		const supplier_score = mp.current_supplier_score != null ? mp.current_supplier_score : (d.supplier_match_score || 0);
		const supplier = mp.current_supplier || d.supplier;
		const unmapped = (d.items || []).filter(i => !i.item_code);

		if (!supplier) {
			frappe.msgprint({ title: "Missing Supplier", message: "Please confirm a supplier before submitting.", indicator: "red" });
			return;
		}
		if (supplier_score < low_threshold) {
			frappe.msgprint({ title: "Low Confidence", message: `Supplier confidence is ${supplier_score}% — below the ${low_threshold}% minimum. Verify the supplier field.`, indicator: "red" });
			return;
		}
		if (unmapped.length > 0) {
			frappe.msgprint({ title: "Unmapped Items", message: `${unmapped.length} item(s) still need to be mapped.`, indicator: "orange" });
			return;
		}

		frappe.confirm(
			`Create Purchase Invoice for <b>${frappe.utils.escape_html(supplier)}</b>?<br>Total: <b>${frappe.format(d.total, { fieldtype: "Currency", currency: d.currency })}</b>`,
			() => {
				frappe.call({
					method: "erpnext_ai_importer.api.submit.create_purchase_invoice",
					args: { import_name: this.name },
					freeze: true,
					freeze_message: "Creating Purchase Invoice…",
				}).then((r) => {
					if (r.message) {
						frappe.show_alert({ message: `Purchase Invoice ${r.message} created`, indicator: "green" }, 4);
						this.doc.status = "Submitted";
						this.doc.purchase_invoice = r.message;
						this._render();
					}
				});
			}
		);
	}

	_reextract() {
		frappe.confirm(
			"Re-run AI extraction? All current extracted data will be overwritten.",
			() => {
				frappe.call({
					method: "erpnext_ai_importer.api.extract.reextract",
					args: { import_name: this.name },
				}).then(() => {
					frappe.show_alert({ message: "Extraction queued — refreshing in 4 seconds…", indicator: "blue" }, 3);
					setTimeout(() => this._load(), 4000);
				});
			}
		);
	}

	_check_duplicates() {
		const d = this.doc;
		if (!d) return;
		const supplier = d.supplier;
		const inv_no   = d.invoice_number;
		if (!supplier && !inv_no) return;

		const checks = [];

		// 1. Existing Purchase Invoices with same bill_no + supplier
		if (inv_no && supplier) {
			checks.push(frappe.call({
				method: "frappe.client.get_list",
				args: {
					doctype: "Purchase Invoice",
					filters: { bill_no: inv_no, supplier, docstatus: ["!=", 2] },
					fields: ["name", "docstatus", "grand_total"],
					limit: 5,
				},
			}));
		} else {
			checks.push(Promise.resolve({ message: [] }));
		}

		// 2. Other AI Document Imports already Submitted for same supplier + invoice number
		if (inv_no && supplier) {
			checks.push(frappe.call({
				method: "frappe.client.get_list",
				args: {
					doctype: "AI Document Import",
					filters: {
						invoice_number: inv_no,
						supplier,
						status: "Submitted",
						name: ["!=", this.name],
					},
					fields: ["name", "purchase_invoice"],
					limit: 5,
				},
			}));
		} else {
			checks.push(Promise.resolve({ message: [] }));
		}

		Promise.all(checks).then(([pi_r, ai_r]) => {
			const pis = pi_r.message || [];
			const ais = ai_r.message || [];
			if (!pis.length && !ais.length) return;

			const lines = [];
			if (pis.length) {
				const links = pis.map(p => {
					const url = frappe.utils.get_form_link("Purchase Invoice", p.name);
					const label = p.docstatus === 1 ? "submitted" : "draft";
					return `<a href="${url}" target="_blank">${frappe.utils.escape_html(p.name)}</a> (${label})`;
				}).join(", ");
				lines.push(`Purchase Invoice already exists for supplier <strong>${frappe.utils.escape_html(supplier)}</strong> with invoice # <strong>${frappe.utils.escape_html(inv_no)}</strong>: ${links}`);
			}
			if (ais.length) {
				const links = ais.map(a => {
					const url = `/app/ai-invoice-validate/${encodeURIComponent(a.name)}`;
					const pi = a.purchase_invoice ? ` → ${frappe.utils.escape_html(a.purchase_invoice)}` : "";
					return `<a href="${url}" target="_blank">${frappe.utils.escape_html(a.name)}${pi}</a>`;
				}).join(", ");
				lines.push(`Already imported via: ${links}`);
			}

			const banner = `
				<div class="aiv-dup-banner" id="aiv-dup-banner">
					<span class="aiv-dup-icon">⚠</span>
					<div class="aiv-dup-links">
						<strong>Duplicate detected</strong><br>
						${lines.join("<br>")}
					</div>
				</div>`;

			$(this.wrapper).find("#ai-validate-root").prepend(banner);
		});
	}

	_open_create_item_dialog(row_name, ai_description) {
		const dialog = new frappe.ui.Dialog({
			title: "Create New Item",
			fields: [
				{
					fieldname: "template_item",
					label: "Start from existing item (optional)",
					fieldtype: "Link",
					options: "Item",
					description: "Load an existing item as a template — fields below will be pre-filled",
					change() {
						const tpl = this.get_value();
						if (!tpl) return;
						frappe.call({
							method: "frappe.client.get",
							args: { doctype: "Item", name: tpl, fieldname: ["item_name", "item_group", "stock_uom", "description"] },
						}).then((r) => {
							if (!r.message) return;
							const m = r.message;
							dialog.set_value("item_name",   m.item_name   || "");
							dialog.set_value("item_group",  m.item_group  || "");
							dialog.set_value("stock_uom",   m.stock_uom   || "");
							dialog.set_value("description", m.description || "");
						});
					},
				},
				{ fieldname: "sec1", fieldtype: "Section Break" },
				{ fieldname: "item_code",  label: "Item Code",       fieldtype: "Data",      reqd: 1, default: ai_description.slice(0, 140) },
				{ fieldname: "item_name",  label: "Item Name",       fieldtype: "Data",      reqd: 1, default: ai_description.slice(0, 140) },
				{ fieldname: "item_group", label: "Item Group",      fieldtype: "Link",      options: "Item Group", reqd: 1 },
				{ fieldname: "stock_uom",  label: "Unit of Measure", fieldtype: "Link",      options: "UOM", default: "Nos", reqd: 1 },
				{ fieldname: "description", label: "Description",    fieldtype: "Small Text", default: ai_description },
			],
			primary_action_label: "Create & Link",
			primary_action: (values) => {
				frappe.call({
					method: "frappe.client.insert",
					args: {
						doc: {
							doctype: "Item",
							item_code: values.item_code,
							item_name: values.item_name,
							item_group: values.item_group,
							stock_uom: values.stock_uom,
							description: values.description || "",
							is_purchase_item: 1,
						},
					},
				}).then((r) => {
					if (!r.message || !r.message.name) return;
					const new_code = r.message.name;
					dialog.hide();
					frappe.show_alert({ message: `Item ${new_code} created`, indicator: "green" }, 3);
					$(this.wrapper).find(`.ai-item-input[data-row="${row_name}"]`).val(new_code);
					this._save_item_field(row_name, "item_code", new_code);
				});
			},
		});
		dialog.show();
	}
}
