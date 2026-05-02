frappe.pages["ai-invoice-validate"].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: "Document Import — Review",
		single_column: true,
	});

	const route = frappe.get_route();
	const name = route && route[1] ? decodeURIComponent(route[1]) : null;
	if (!name) {
		$(wrapper).find(".page-content").html(
			'<div style="padding:48px;text-align:center;color:#dc2626">No import name specified. <a href="/app/ai-invoice-importer">← Back to Importer</a></div>'
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
					`<div style="padding:48px;text-align:center;color:#dc2626">Import record "${this.name}" not found.</div>`
				);
				return;
			}
			this.page.set_title(`Review — ${this.name}`);
			this._render();
		});
	}

	_render() {
		const d = this.doc;
		const s = this.settings;
		const mp = this.match_preview || {};
		const low_threshold = s.supplier_low_confidence || 60;
		const item_threshold = s.item_match_threshold || 70;

		const ai_conf = d.ai_confidence ? `${Math.round(d.ai_confidence)}%` : "—";
		const ai_conf_color = d.ai_confidence >= 80 ? "#16a34a" : d.ai_confidence >= 50 ? "#d97706" : "#dc2626";

		const items_html = (d.items || []).map((item) => this._item_row_html(item, item_threshold)).join("");
		const tax_html = this._tax_html(d);
		const status_badge = this._status_badge(d.status);
		const unmapped_count = (d.items || []).filter(i => !i.item_code).length;
		const supplier_score = mp.current_supplier_score != null ? mp.current_supplier_score : (d.supplier_match_score || 0);
		const can_submit = d.status === "Pending Validation" && (mp.current_supplier || d.supplier) && supplier_score >= low_threshold && unmapped_count === 0;

		$(this.wrapper).find(".page-content").html(`
			<div id="ai-validate-root" style="max-width:980px;margin:0 auto;padding:16px">

				<!-- Header bar -->
				<div style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:12px;padding:14px 16px;
					background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px 8px 0 0;border-bottom:none;align-items:start">
					${this._meta_field("Source File", this._file_link(d.source_file))}
					${this._meta_field("Method", frappe.utils.escape_html(d.extraction_method || "—") + (d.model_used ? `<br><span style="font-size:0.78em;color:#94a3b8">${frappe.utils.escape_html(d.model_used)}</span>` : ""))}
					${this._meta_field("AI Confidence", `<span style="color:${ai_conf_color};font-weight:600;font-size:1.1em">${ai_conf}</span>`)}
					<div style="text-align:right">
						${status_badge}
						<br><span style="font-size:0.72em;color:#94a3b8;margin-top:4px;display:block">${frappe.utils.escape_html(this.name)}</span>
					</div>
				</div>

				<!-- Main card -->
				<div style="border:1px solid #e2e8f0;border-radius:0 0 8px 8px;background:#fff">

					<!-- Match Intelligence -->
					<div style="padding:16px;border-bottom:2px solid #e2e8f0;background:#fafbfc">
						<div style="font-size:0.7em;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:14px">
							Match Intelligence
						</div>
						<div style="display:grid;grid-template-columns:1fr 1fr;gap:32px">
							${this._match_block_html("company", "Our Company", mp.extracted_company, mp.company_matches || [], mp.current_company || d.company || "", null)}
							${this._match_block_html("supplier", "Supplier / Party", mp.extracted_supplier, mp.supplier_matches || [], mp.current_supplier || d.supplier || "", supplier_score)}
						</div>
					</div>

					<!-- Invoice meta -->
					<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:14px 16px;border-bottom:1px solid #e2e8f0">
						${this._editable_field("invoice_number", "Doc / Invoice #", d.invoice_number)}
						${this._editable_field("invoice_date", "Date", d.invoice_date, "date")}
						${this._editable_field("due_date", "Due Date", d.due_date, "date")}
						<div>
							<div style="font-size:0.78em;font-weight:600;color:#374151;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.04em">Currency</div>
							<div style="font-size:0.9em;color:#374151;padding:7px 0">${frappe.utils.escape_html(d.currency || "—")}</div>
						</div>
					</div>

					<!-- Line items -->
					<div style="padding:16px;border-bottom:1px solid #e2e8f0">
						<div style="font-size:0.8em;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:10px">
							Line Items
							${unmapped_count > 0 ? `<span style="font-size:0.85em;font-weight:400;color:#d97706;margin-left:8px">⚠ ${unmapped_count} need mapping</span>` : ""}
						</div>
						<table style="width:100%;border-collapse:collapse;font-size:0.83em" id="ai-items-table">
							<thead>
								<tr style="background:#f8fafc;text-align:left">
									<th style="padding:7px 10px;border:1px solid #e2e8f0;color:#64748b;font-weight:500">AI Description</th>
									<th style="padding:7px 10px;border:1px solid #e2e8f0;color:#64748b;font-weight:500">Matched Item</th>
									<th style="padding:7px 10px;border:1px solid #e2e8f0;color:#64748b;font-weight:500;text-align:center;width:60px">Match %</th>
									<th style="padding:7px 10px;border:1px solid #e2e8f0;color:#64748b;font-weight:500;text-align:right;width:60px">Qty</th>
									<th style="padding:7px 10px;border:1px solid #e2e8f0;color:#64748b;font-weight:500;text-align:right;width:90px">Rate</th>
									<th style="padding:7px 10px;border:1px solid #e2e8f0;color:#64748b;font-weight:500;text-align:right;width:90px">Amount</th>
								</tr>
							</thead>
							<tbody>${items_html}</tbody>
						</table>
					</div>

					<!-- Taxes + Totals -->
					<div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #e2e8f0">
						<div style="padding:16px;border-right:1px solid #e2e8f0">
							<div style="font-size:0.8em;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px">Detected Taxes</div>
							${tax_html}
						</div>
						<div style="padding:16px;text-align:right">
							<div style="font-size:0.85em;color:#64748b">Subtotal: <strong>${frappe.format(d.subtotal || 0, { fieldtype: "Currency", currency: d.currency })}</strong></div>
							<div style="font-size:0.85em;color:#64748b;margin-top:2px">Taxes: <strong>${frappe.format(d.tax_amount || 0, { fieldtype: "Currency", currency: d.currency })}</strong></div>
							<div style="font-size:1.2em;font-weight:700;margin-top:8px;color:#1e293b">${frappe.format(d.total || 0, { fieldtype: "Currency", currency: d.currency })}</div>
						</div>
					</div>

					<!-- Action bar -->
					<div style="padding:14px 16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
						${d.status === "Pending Validation" ? `
							<button id="ai-submit-btn"
								style="background:${can_submit ? "#4f46e5" : "#94a3b8"};color:#fff;border:none;
								       border-radius:4px;padding:9px 18px;font-size:0.9em;cursor:${can_submit ? "pointer" : "not-allowed"};font-weight:500">
								✓ Create Purchase Invoice
							</button>
							<button id="ai-reextract-btn"
								style="background:#fff;border:1px solid #cbd5e1;color:#374151;
								       border-radius:4px;padding:9px 14px;font-size:0.9em;cursor:pointer">
								↺ Re-extract
							</button>
						` : ""}
						${d.status === "Draft" ? `
							<button id="ai-reextract-btn"
								style="background:#4f46e5;color:#fff;border:none;
								       border-radius:4px;padding:9px 18px;font-size:0.9em;cursor:pointer;font-weight:500">
								⚙ Extract Now
							</button>
						` : ""}
						${d.status === "Submitted" && d.purchase_invoice ? `
							<a href="${frappe.utils.get_form_link("Purchase Invoice", d.purchase_invoice)}"
								style="background:#fff;border:1px solid #4f46e5;color:#4f46e5;
								       border-radius:4px;padding:9px 14px;font-size:0.9em;text-decoration:none;font-weight:500">
								View ${frappe.utils.escape_html(d.purchase_invoice)} →
							</a>
						` : ""}
						<a href="/app/ai-invoice-importer"
							style="margin-left:auto;font-size:0.85em;color:#64748b;text-decoration:none">
							← Back to Importer
						</a>
						<span id="ai-submit-warning"
							style="font-size:0.82em;color:#d97706;${(unmapped_count > 0 || supplier_score < low_threshold) && d.status === "Pending Validation" ? "" : "display:none"}">
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
		const score_color = top_score >= 85 ? "#16a34a" : top_score >= 60 ? "#d97706" : "#dc2626";
		const score_bg    = top_score >= 85 ? "#f0fdf4" : top_score >= 60 ? "#fffbeb" : (current_val ? "#fef2f2" : "#f8fafc");
		const border_col  = top_score >= 85 ? "#86efac" : top_score >= 60 ? "#fde68a" : (current_val ? "#fca5a5" : "#e2e8f0");
		const alts = matches.slice(1, 3);

		return `
		<div>
			<div style="font-size:0.72em;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">${label}</div>
			${extracted ? `<div style="font-size:0.75em;color:#94a3b8;margin-bottom:8px">AI extracted: <em>"${frappe.utils.escape_html(extracted)}"</em></div>` : `<div style="font-size:0.75em;color:#94a3b8;margin-bottom:8px">No text extracted yet</div>`}

			<div style="display:flex;align-items:stretch;gap:8px;margin-bottom:8px">
				<div style="position:relative;flex:1">
					<input id="ai-${fieldname}-input" type="text"
						value="${frappe.utils.escape_html(current_val || "")}"
						placeholder="Search ${frappe.utils.escape_html(label)}…"
						style="width:100%;border:2px solid ${border_col};border-radius:6px;padding:8px 12px;
						       background:${score_bg};box-sizing:border-box;font-size:0.9em;font-weight:500;
						       color:#1e293b;outline:none">
					<div id="ai-${fieldname}-suggestions"
						style="display:none;position:absolute;top:100%;left:0;right:0;margin-top:2px;
						       background:#fff;border:1px solid #cbd5e1;border-radius:6px;
						       box-shadow:0 8px 24px rgba(0,0,0,0.12);z-index:200;max-height:200px;overflow-y:auto;font-size:0.85em"></div>
				</div>
				${has_score ? `
				<div style="display:flex;align-items:center;padding:0 12px;border-radius:6px;
				            background:${score_bg};border:2px solid ${border_col};
				            font-size:0.9em;font-weight:700;color:${score_color};white-space:nowrap;min-width:52px;justify-content:center">
					${top_score}%
				</div>` : ""}
			</div>

			${alts.length ? `
			<div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center">
				<span style="font-size:0.7em;color:#94a3b8;margin-right:2px">Also:</span>
				${alts.map(a => `
					<button class="ai-alt-pick"
						data-fieldname="${fieldname}"
						data-value="${frappe.utils.escape_html(a.name)}"
						data-display="${frappe.utils.escape_html(a.display)}"
						style="font-size:0.74em;padding:3px 9px;border:1px solid #e2e8f0;border-radius:12px;
						       background:#f8fafc;color:#475569;cursor:pointer;white-space:nowrap">
						${frappe.utils.escape_html(a.display)}
						<span style="color:#94a3b8;margin-left:3px">${a.score}%</span>
					</button>
				`).join("")}
			</div>` : ""}
		</div>`;
	}

	_meta_field(label, value_html) {
		return `<div>
			<div style="font-size:0.72em;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">${label}</div>
			<div style="font-size:0.88em;color:#374151">${value_html}</div>
		</div>`;
	}

	_editable_field(fieldname, label, value, type) {
		const val = value || "";
		return `<div>
			<div style="font-size:0.78em;font-weight:600;color:#374151;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.04em">${label}</div>
			<input data-fieldname="${fieldname}" type="${type || "text"}" value="${frappe.utils.escape_html(val)}"
				style="width:100%;border:1px solid #cbd5e1;border-radius:4px;padding:7px 10px;
				       background:#fff;box-sizing:border-box;font-size:0.9em">
		</div>`;
	}

	_file_link(source_file) {
		if (!source_file) return "—";
		const name = source_file.split("/").pop();
		return `<a href="${source_file}" target="_blank" style="color:#4f46e5">📎 ${frappe.utils.escape_html(name)}</a>`;
	}

	_item_row_html(item, threshold) {
		const score = item.item_match_score || 0;
		const needs_mapping = score < threshold || !item.item_code;
		const row_bg = needs_mapping ? "#fffbeb" : "#fff";
		const score_color = score >= 85 ? "#16a34a" : score >= threshold ? "#d97706" : "#dc2626";

		const matched_cell = needs_mapping ? `
			<div style="display:flex;flex-direction:column;gap:4px">
				<span style="color:#d97706;font-size:0.85em">⚠ ${item.item_code ? "Low match" : "No match"}</span>
				<div style="position:relative">
					<input type="text" class="ai-item-input" data-row="${frappe.utils.escape_html(item.name)}"
						value="${frappe.utils.escape_html(item.item_code || "")}"
						placeholder="Search item…"
						style="width:100%;border:1px solid #fbbf24;border-radius:3px;padding:4px 6px;
						       background:#fff;box-sizing:border-box;font-size:0.85em">
					<div class="ai-item-suggestions" data-row="${frappe.utils.escape_html(item.name)}"
						style="display:none;position:absolute;top:100%;left:0;right:0;
						background:#fff;border:1px solid #cbd5e1;border-radius:4px;
						box-shadow:0 4px 12px rgba(0,0,0,0.1);z-index:100;max-height:160px;overflow-y:auto;font-size:0.85em">
					</div>
				</div>
			</div>
		` : `<span style="color:#16a34a">✓ ${frappe.utils.escape_html(item.item_code || "—")}</span>`;

		return `<tr style="background:${row_bg}">
			<td style="padding:7px 10px;border:1px solid #e2e8f0">${frappe.utils.escape_html(item.ai_description || "—")}</td>
			<td style="padding:7px 10px;border:1px solid #e2e8f0">${matched_cell}</td>
			<td style="padding:7px 10px;border:1px solid #e2e8f0;text-align:center;color:${score_color};font-weight:600">${score}%</td>
			<td style="padding:7px 10px;border:1px solid #e2e8f0;text-align:right">${item.qty || 0}</td>
			<td style="padding:7px 10px;border:1px solid #e2e8f0;text-align:right">${frappe.format(item.rate || 0, { fieldtype: "Currency", currency: this.doc.currency })}</td>
			<td style="padding:7px 10px;border:1px solid #e2e8f0;text-align:right">${frappe.format(item.amount || 0, { fieldtype: "Currency", currency: this.doc.currency })}</td>
		</tr>`;
	}

	_tax_html(d) {
		if (!d.tax_amount || d.tax_amount === 0) {
			return `<div style="font-size:0.85em;color:#94a3b8">No tax lines detected</div>`;
		}
		let html = d.tax_template
			? `<div style="font-size:0.85em;margin-bottom:6px">
				<span style="background:#f0fdf4;border:1px solid #bbf7d0;padding:4px 10px;border-radius:4px">
					${frappe.utils.escape_html(d.tax_template)} → <strong>${frappe.format(d.tax_amount, { fieldtype: "Currency", currency: d.currency })}</strong>
				</span>
			   </div>`
			: `<div style="font-size:0.85em;color:#374151">Total tax: <strong>${frappe.format(d.tax_amount, { fieldtype: "Currency", currency: d.currency })}</strong></div>`;
		html += `<div style="font-size:0.78em;color:#94a3b8;margin-top:4px">Mapped to tax template on the generated invoice</div>`;
		return html;
	}

	_status_badge(status) {
		const map = {
			"Draft":               { bg: "#f1f5f9", color: "#475569" },
			"Extracting":          { bg: "#dbeafe", color: "#1e40af" },
			"Pending Validation":  { bg: "#fef3c7", color: "#92400e" },
			"Submitted":           { bg: "#dcfce7", color: "#166534" },
			"Failed":              { bg: "#fee2e2", color: "#991b1b" },
		};
		const s = map[status] || { bg: "#f1f5f9", color: "#374151" };
		return `<span style="background:${s.bg};color:${s.color};padding:4px 12px;border-radius:4px;font-size:0.82em;font-weight:600">${status}</span>`;
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
						`<div class="ai-match-option" data-fieldname="${fieldname}" data-value="${frappe.utils.escape_html(row.value)}"
							style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #f1f5f9;color:#374151">
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
					`<div class="ai-item-option" data-row="${frappe.utils.escape_html(row_name)}" data-value="${frappe.utils.escape_html(row.value)}"
						style="padding:6px 10px;cursor:pointer;border-bottom:1px solid #f1f5f9;color:#374151">
						${frappe.utils.escape_html(row.value)}
						${row.description ? `<span style="color:#94a3b8;font-size:0.85em;margin-left:4px">${frappe.utils.escape_html(row.description)}</span>` : ""}
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
		const can_submit = d.status === "Pending Validation" && (mp.current_supplier || d.supplier) && supplier_score >= low_threshold && unmapped_count === 0;

		const btn = $(this.wrapper).find("#ai-submit-btn");
		btn.css({ background: can_submit ? "#4f46e5" : "#94a3b8", cursor: can_submit ? "pointer" : "not-allowed" });
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
}
