frappe.pages["ai-invoice-validate"].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: "Validate Invoice Import",
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
			// Reuse the page object, just reload for the new record
			frappe.ai_validate_page.name = name;
			frappe.ai_validate_page.doc = null;
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
		this._load();
	}

	_load() {
		Promise.all([
			frappe.call({ method: "frappe.client.get", args: { doctype: "AI Invoice Import", name: this.name } }),
			frappe.call({ method: "frappe.client.get", args: { doctype: "AI Import Settings", name: "AI Import Settings" } }),
		]).then(([doc_r, settings_r]) => {
			this.doc = doc_r.message;
			this.settings = settings_r.message || {};
			if (!this.doc) {
				$(this.wrapper).find(".page-content").html(
					`<div style="padding:48px;text-align:center;color:#dc2626">Import record "${this.name}" not found.</div>`
				);
				return;
			}
			this.page.set_title(`Validate — ${this.name}`);
			this._render();
		});
	}

	_render() {
		const d = this.doc;
		const s = this.settings;
		const low_threshold = s.supplier_low_confidence || 60;
		const auto_accept = s.supplier_auto_accept || 85;
		const item_threshold = s.item_match_threshold || 70;

		const supplier_score = d.supplier_match_score || 0;
		const conf_color = supplier_score >= auto_accept ? "#16a34a" : supplier_score >= low_threshold ? "#d97706" : "#dc2626";
		const conf_border = supplier_score >= auto_accept ? "#16a34a" : supplier_score >= low_threshold ? "#f59e0b" : "#dc2626";
		const conf_bg = supplier_score >= auto_accept ? "#f0fdf4" : supplier_score >= low_threshold ? "#fffbeb" : "#fef2f2";
		const conf_label = supplier_score >= auto_accept ? `✓ matched (${supplier_score}%)` : supplier_score >= low_threshold ? `⚠ low confidence (${supplier_score}%)` : `✕ very low (${supplier_score}%)`;

		const ai_conf = d.ai_confidence ? `${Math.round(d.ai_confidence)}%` : "—";
		const ai_conf_color = d.ai_confidence >= 80 ? "#16a34a" : d.ai_confidence >= 50 ? "#d97706" : "#dc2626";

		const items_html = (d.items || []).map((item) => this._item_row_html(item, item_threshold)).join("");

		const tax_html = this._tax_html(d);
		const status_badge = this._status_badge(d.status);
		const unmapped_count = (d.items || []).filter(i => !i.item_code).length;
		const can_submit = d.status === "Pending Validation" && d.supplier && supplier_score >= low_threshold && unmapped_count === 0;

		$(this.wrapper).find(".page-content").html(`
			<div id="ai-validate-root" style="max-width:960px;margin:0 auto;padding:16px">

				<!-- Header bar -->
				<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:16px;
					background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px 8px 0 0;border-bottom:none">
					${this._meta_field("Company", frappe.utils.escape_html(d.company || "—"))}
					${this._meta_field("Source File", this._file_link(d.source_file))}
					${this._meta_field("Extraction Method", frappe.utils.escape_html(d.extraction_method || "—") + (d.model_used ? `<br><span style="font-size:0.78em;color:#94a3b8">${frappe.utils.escape_html(d.model_used)}</span>` : ""))}
					${this._meta_field("AI Confidence", `<span style="color:${ai_conf_color};font-weight:600">${ai_conf}</span>`)}
				</div>

				<!-- Main card -->
				<div style="border:1px solid #e2e8f0;border-radius:0 0 8px 8px;background:#fff">

					<!-- Status + record name -->
					<div style="display:flex;justify-content:space-between;align-items:center;
						padding:10px 16px;background:#fff;border-bottom:1px solid #f1f5f9">
						<span style="font-size:0.85em;color:#64748b">${frappe.utils.escape_html(this.name)}</span>
						${status_badge}
					</div>

					<!-- Supplier + Invoice meta -->
					<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:12px;padding:16px;border-bottom:1px solid #e2e8f0">

						<!-- Supplier (editable) -->
						<div>
							<div style="font-size:0.78em;font-weight:600;color:#374151;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.04em">
								Supplier
								<span style="font-size:0.9em;font-weight:400;text-transform:none;letter-spacing:0;color:${conf_color};margin-left:6px">${conf_label}</span>
							</div>
							<div style="position:relative">
								<input id="ai-supplier-input" type="text"
									value="${frappe.utils.escape_html(d.supplier || "")}"
									placeholder="Search supplier…"
									style="width:100%;border:2px solid ${conf_border};border-radius:4px;padding:7px 10px;
									       background:${conf_bg};box-sizing:border-box;font-size:0.9em">
								<div id="ai-supplier-suggestions" style="display:none;position:absolute;top:100%;left:0;right:0;
									background:#fff;border:1px solid #cbd5e1;border-radius:4px;box-shadow:0 4px 12px rgba(0,0,0,0.1);
									z-index:100;max-height:180px;overflow-y:auto;font-size:0.85em"></div>
							</div>
							${d.extracted_supplier_name ? `<div style="font-size:0.75em;color:#94a3b8;margin-top:3px">AI extracted: "${frappe.utils.escape_html(d.extracted_supplier_name)}"</div>` : ""}
						</div>

						${this._editable_field("invoice_number", "Invoice Number", d.invoice_number)}
						${this._editable_field("invoice_date", "Invoice Date", d.invoice_date, "date")}
						${this._editable_field("due_date", "Due Date", d.due_date, "date")}
					</div>

					<!-- Line items -->
					<div style="padding:16px;border-bottom:1px solid #e2e8f0">
						<div style="font-size:0.8em;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:10px">Line Items</div>
						<table style="width:100%;border-collapse:collapse;font-size:0.83em" id="ai-items-table">
							<thead>
								<tr style="background:#f8fafc;text-align:left">
									<th style="padding:7px 10px;border:1px solid #e2e8f0;color:#64748b;font-weight:500">AI Description</th>
									<th style="padding:7px 10px;border:1px solid #e2e8f0;color:#64748b;font-weight:500">Matched Item</th>
									<th style="padding:7px 10px;border:1px solid #e2e8f0;color:#64748b;font-weight:500;text-align:center">Match %</th>
									<th style="padding:7px 10px;border:1px solid #e2e8f0;color:#64748b;font-weight:500;text-align:right">Qty</th>
									<th style="padding:7px 10px;border:1px solid #e2e8f0;color:#64748b;font-weight:500;text-align:right">Rate</th>
									<th style="padding:7px 10px;border:1px solid #e2e8f0;color:#64748b;font-weight:500;text-align:right">Amount</th>
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
							<div style="font-size:1.15em;font-weight:700;margin-top:6px">${frappe.format(d.total || 0, { fieldtype: "Currency", currency: d.currency })}</div>
							${d.currency ? `<div style="font-size:0.75em;color:#94a3b8;margin-top:2px">Currency: ${frappe.utils.escape_html(d.currency)}</div>` : ""}
						</div>
					</div>

					<!-- Action bar -->
					<div style="padding:14px 16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
						${d.status === "Pending Validation" ? `
							<button id="ai-submit-btn"
								style="background:${can_submit ? "#4f46e5" : "#94a3b8"};color:#fff;border:none;
								       border-radius:4px;padding:9px 18px;font-size:0.9em;cursor:pointer;font-weight:500">
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
						<span id="ai-submit-warning" style="font-size:0.82em;color:#d97706;${unmapped_count > 0 || supplier_score < low_threshold ? "" : "display:none"}">
							${unmapped_count > 0 ? `⚠ ${unmapped_count} item(s) need mapping` : "⚠ Supplier confidence too low — select a supplier to confirm"}
						</span>
					</div>

				</div>

			</div>
		`);

		this._bind_events();
	}

	_meta_field(label, value_html) {
		return `<div>
			<div style="font-size:0.75em;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px">${label}</div>
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
				<span style="color:#d97706;font-size:0.85em">⚠ ${item.item_code ? "Low match" : "No match"} (${score}%)</span>
				<div style="position:relative">
					<input type="text" class="ai-item-input" data-row="${frappe.utils.escape_html(item.name)}"
						value="${frappe.utils.escape_html(item.item_code || "")}"
						placeholder="Search or select item…"
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
			<td style="padding:7px 10px;border:1px solid #e2e8f0;text-align:center;color:${score_color}">${score}%</td>
			<td style="padding:7px 10px;border:1px solid #e2e8f0;text-align:right">${item.qty || 0}</td>
			<td style="padding:7px 10px;border:1px solid #e2e8f0;text-align:right">${frappe.format(item.rate || 0, { fieldtype: "Currency", currency: this.doc.currency })}</td>
			<td style="padding:7px 10px;border:1px solid #e2e8f0;text-align:right">${frappe.format(item.amount || 0, { fieldtype: "Currency", currency: this.doc.currency })}</td>
		</tr>`;
	}

	_tax_html(d) {
		if (!d.tax_amount || d.tax_amount === 0) {
			return `<div style="font-size:0.85em;color:#94a3b8">No tax lines detected</div>`;
		}
		let html = "";
		if (d.tax_template) {
			html += `<div style="font-size:0.85em;margin-bottom:6px">
				<span style="background:#f0fdf4;border:1px solid #bbf7d0;padding:4px 10px;border-radius:4px">
					${frappe.utils.escape_html(d.tax_template)} → <strong>${frappe.format(d.tax_amount, { fieldtype: "Currency", currency: d.currency })}</strong>
				</span>
			</div>`;
		} else {
			html += `<div style="font-size:0.85em;color:#374151">Total tax: <strong>${frappe.format(d.tax_amount, { fieldtype: "Currency", currency: d.currency })}</strong></div>`;
		}
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
		return `<span style="background:${s.bg};color:${s.color};padding:4px 12px;border-radius:4px;font-size:0.82em;font-weight:500">${status}</span>`;
	}

	_bind_events() {
		const root = $(this.wrapper).find("#ai-validate-root");

		// Supplier autocomplete
		const sup_input = root.find("#ai-supplier-input");
		const sup_suggestions = root.find("#ai-supplier-suggestions");

		sup_input.on("input", frappe.utils.debounce((e) => {
			const txt = e.target.value.trim();
			if (txt.length < 2) { sup_suggestions.hide(); return; }
			frappe.call({
				method: "frappe.desk.search.search_link",
				args: { txt, doctype: "Supplier", ignore_user_permissions: 0 },
			}).then((r) => {
				const results = r.message || [];
				if (!results.length) { sup_suggestions.hide(); return; }
				sup_suggestions.html(results.map((row) =>
					`<div class="ai-sup-option" data-value="${frappe.utils.escape_html(row.value)}"
						style="padding:7px 12px;cursor:pointer;border-bottom:1px solid #f1f5f9;color:#374151">
						${frappe.utils.escape_html(row.value)}
					</div>`
				).join("")).show();
			});
		}, 300));

		sup_suggestions.on("click", ".ai-sup-option", (e) => {
			const val = $(e.currentTarget).data("value");
			sup_input.val(val);
			sup_suggestions.hide();
			this._save_field("supplier", val);
		});

		sup_input.on("blur", () => setTimeout(() => sup_suggestions.hide(), 200));
		sup_input.on("keydown", (e) => {
			if (e.key === "Enter") {
				this._save_field("supplier", sup_input.val().trim());
				sup_suggestions.hide();
			}
		});

		// Scalar field edits (invoice_number, invoice_date, due_date)
		root.find("input[data-fieldname]").on("change", (e) => {
			const fieldname = $(e.target).data("fieldname");
			const val = e.target.value;
			this._save_field(fieldname, val);
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
			const inp = root.find(`.ai-item-input[data-row="${row_name}"]`);
			inp.val(val);
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

		// Action buttons
		root.find("#ai-submit-btn").on("click", () => this._submit());
		root.find("#ai-reextract-btn").on("click", () => this._reextract());
	}

	_save_field(fieldname, value) {
		const updates = { [fieldname]: value };
		// Manual supplier selection → treat as 100% confident
		if (fieldname === "supplier") {
			updates.supplier_match_score = 100;
		}
		frappe.call({
			method: "frappe.client.set_value",
			args: { doctype: "AI Invoice Import", name: this.name, fieldname: updates },
		}).then((r) => {
			if (r.message) {
				frappe.show_alert({ message: `${fieldname} saved`, indicator: "green" }, 2);
				Object.assign(this.doc, updates);
				this._reload_submit_state();
			}
		});
	}

	_save_item_field(row_name, fieldname, value) {
		frappe.call({
			method: "frappe.client.set_value",
			args: { doctype: "AI Invoice Import Item", name: row_name, fieldname, value },
		}).then((r) => {
			if (r.message) {
				frappe.show_alert({ message: "Item mapped", indicator: "green" }, 2);
				// Update local item
				const item = (this.doc.items || []).find(i => i.name === row_name);
				if (item) { item[fieldname] = value; item.manually_mapped = 1; }
				this._reload_submit_state();
			}
		});
	}

	_reload_header_indicators() {
		// Re-render just the action bar with updated state
		this._reload_submit_state();
	}

	_reload_submit_state() {
		const d = this.doc;
		const s = this.settings;
		const low_threshold = s.supplier_low_confidence || 60;
		const supplier_score = d.supplier_match_score || 0;
		const unmapped_count = (d.items || []).filter(i => !i.item_code).length;
		const can_submit = d.status === "Pending Validation" && d.supplier && supplier_score >= low_threshold && unmapped_count === 0;
		const btn = $(this.wrapper).find("#ai-submit-btn");
		btn.css({ background: can_submit ? "#4f46e5" : "#94a3b8", cursor: can_submit ? "pointer" : "not-allowed" });
		btn.prop("disabled", !can_submit);
		// Update warning text
		const warn = $(this.wrapper).find("#ai-submit-warning");
		if (unmapped_count > 0) {
			warn.text(`⚠ ${unmapped_count} item(s) need mapping`).show();
		} else if (!d.supplier || supplier_score < low_threshold) {
			warn.text(`⚠ Supplier confidence too low — select a supplier to confirm`).show();
		} else {
			warn.hide();
		}
	}

	_submit() {
		const d = this.doc;
		const s = this.settings;
		const low_threshold = s.supplier_low_confidence || 60;
		const supplier_score = d.supplier_match_score || 0;
		const unmapped = (d.items || []).filter(i => !i.item_code);

		if (!d.supplier) {
			frappe.msgprint({ title: "Missing Supplier", message: "Please select a supplier before submitting.", indicator: "red" });
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
			`Create Purchase Invoice for <b>${frappe.utils.escape_html(d.supplier)}</b>?<br>Total: <b>${frappe.format(d.total, { fieldtype: "Currency", currency: d.currency })}</b>`,
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
					frappe.show_alert({ message: "Extraction queued — refreshing in 3 seconds…", indicator: "blue" }, 3);
					setTimeout(() => this._load(), 4000);
				});
			}
		);
	}
}
