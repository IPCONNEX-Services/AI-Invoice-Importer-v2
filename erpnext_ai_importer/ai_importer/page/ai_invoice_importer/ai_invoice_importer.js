frappe.pages["ai-invoice-importer"].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: "Supplier Invoice Importer",
		single_column: true,
	});

	frappe.ai_importer_page = new AiImporterPage(page, wrapper);
};

frappe.pages["ai-invoice-importer"].on_page_show = function (wrapper) {
	if (frappe.ai_importer_page) {
		frappe.ai_importer_page.refresh_job_list();
	}
};

class AiImporterPage {
	constructor(page, wrapper) {
		this.page = page;
		this.wrapper = wrapper;
		this.companies = [];
		this.providers = ["Claude (default)", "OpenAI", "Gemini"];
		this.scanned_modes = ["AI Vision (auto-detect)", "Local OCR (tesseract)", "Skip scanned"];
		this.job_list_interval = null;

		this._load_companies().then(() => {
			this._render();
			this.refresh_job_list();
			this._start_auto_refresh();
		});
	}

	_load_companies() {
		return frappe.call({
			method: "frappe.client.get_list",
			args: { doctype: "Company", fields: ["name"], limit: 50 },
		}).then((r) => {
			this.companies = (r.message || []).map((c) => c.name);
		});
	}

	_render() {
		const companies_opts = this.companies.map((c) => `<option>${frappe.utils.escape_html(c)}</option>`).join("");
		const providers_opts = this.providers.map((p) => `<option>${p}</option>`).join("");
		const scanned_opts = this.scanned_modes.map((m) => `<option>${m}</option>`).join("");

		$(this.wrapper).find(".page-content").html(`
			<div id="ai-importer-root" style="max-width:960px;margin:0 auto;padding:16px">

				<!-- Upload zone + options -->
				<div style="display:grid;grid-template-columns:1fr 240px;gap:16px;align-items:start;margin-bottom:24px">

					<!-- Drop zone -->
					<div id="ai-drop-zone"
						style="border:2px dashed #a5b4fc;border-radius:8px;padding:48px 32px;text-align:center;
						       background:#f5f3ff;cursor:pointer;transition:background 0.15s">
						<div style="font-size:2.4em;margin-bottom:8px">📂</div>
						<div style="font-weight:600;color:#4f46e5;font-size:1.05em">Drop files here or click to browse</div>
						<div style="font-size:0.82em;color:#64748b;margin-top:6px">PDF · Excel · CSV · ZIP (batch) · Max 50 MB</div>
						<input type="file" id="ai-file-input" accept=".pdf,.xlsx,.xls,.csv,.zip"
							style="display:none" multiple>
					</div>

					<!-- Options panel -->
					<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;font-size:0.85em">
						<div style="font-weight:600;color:#374151;margin-bottom:12px;font-size:0.9em;text-transform:uppercase;letter-spacing:0.04em">
							Import Options
						</div>
						<div style="margin-bottom:10px">
							<div style="color:#374151;margin-bottom:4px">Company</div>
							<select id="ai-company" style="width:100%;border:1px solid #cbd5e1;border-radius:4px;padding:6px;background:#fff">
								${companies_opts}
							</select>
						</div>
						<div style="margin-bottom:10px">
							<div style="color:#374151;margin-bottom:4px">AI Provider</div>
							<select id="ai-provider" style="width:100%;border:1px solid #cbd5e1;border-radius:4px;padding:6px;background:#fff">
								${providers_opts}
							</select>
						</div>
						<div style="margin-bottom:14px">
							<div style="color:#374151;margin-bottom:4px">Scanned PDF handling</div>
							<select id="ai-scanned" style="width:100%;border:1px solid #cbd5e1;border-radius:4px;padding:6px;background:#fff">
								${scanned_opts}
							</select>
						</div>
						<button id="ai-upload-btn"
							style="width:100%;background:#4f46e5;color:#fff;border:none;border-radius:4px;
							       padding:9px;font-size:0.9em;cursor:pointer;font-weight:500">
							Upload &amp; Extract →
						</button>
					</div>
				</div>

				<!-- Upload progress (hidden initially) -->
				<div id="ai-upload-progress" style="display:none;margin-bottom:16px;padding:12px 16px;
					background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;font-size:0.85em;color:#1e40af">
				</div>

				<!-- Job list -->
				<div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
					<div style="display:flex;justify-content:space-between;align-items:center;
						padding:12px 16px;border-bottom:1px solid #e2e8f0">
						<span style="font-weight:600;color:#374151">Recent Imports</span>
						<span id="ai-job-count" style="font-size:0.8em;color:#64748b"></span>
					</div>
					<div id="ai-job-list">
						<div style="padding:32px;text-align:center;color:#94a3b8;font-size:0.9em">Loading…</div>
					</div>
				</div>
			</div>
		`);

		this._bind_events();
	}

	_bind_events() {
		const root = $(this.wrapper).find("#ai-importer-root");

		// Drop zone drag events
		const zone = root.find("#ai-drop-zone");
		zone.on("dragover", (e) => {
			e.preventDefault();
			zone.css("background", "#ede9fe");
		});
		zone.on("dragleave", () => zone.css("background", "#f5f3ff"));
		zone.on("drop", (e) => {
			e.preventDefault();
			zone.css("background", "#f5f3ff");
			const files = e.originalEvent.dataTransfer.files;
			if (files.length) this._upload_files(files);
		});
		zone.on("click", () => root.find("#ai-file-input").click());

		// File input change
		root.find("#ai-file-input").on("change", (e) => {
			if (e.target.files.length) this._upload_files(e.target.files);
		});

		// Upload button
		root.find("#ai-upload-btn").on("click", () => root.find("#ai-file-input").click());
	}

	_get_provider_key(display) {
		if (display.startsWith("OpenAI")) return "OpenAI";
		if (display.startsWith("Gemini")) return "Gemini";
		return "Claude";
	}

	_get_scanned_key(display) {
		if (display.startsWith("Local OCR")) return "ocr";
		if (display.startsWith("Skip")) return "skip";
		return "ai_vision";
	}

	_upload_files(files) {
		const root = $(this.wrapper).find("#ai-importer-root");
		const company = root.find("#ai-company").val();
		if (!company) {
			frappe.msgprint("Please select a Company before uploading.");
			return;
		}
		const provider = this._get_provider_key(root.find("#ai-provider").val());
		const scanned = this._get_scanned_key(root.find("#ai-scanned").val());

		const progress_el = root.find("#ai-upload-progress");
		progress_el.show().text(`Uploading ${files.length} file(s)…`);

		const uploads = Array.from(files).map((file) => this._upload_one(file, company, provider, scanned));
		Promise.all(uploads)
			.then((results) => {
				const flat = results.flat();
				progress_el.css({ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534" })
					.html(`✓ ${flat.length} import job(s) queued: <strong>${flat.join(", ")}</strong>`);
				this.refresh_job_list();
				// Reset file input
				root.find("#ai-file-input").val("");
			})
			.catch((err) => {
				progress_el.css({ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" })
					.text("Upload failed: " + (err.message || err));
			});
	}

	_upload_one(file, company, provider, scanned) {
		const form_data = new FormData();
		form_data.append("file", file);
		form_data.append("company", company);
		form_data.append("provider", provider);
		form_data.append("scanned_mode", scanned);

		return fetch("/api/method/erpnext_ai_importer.api.upload.upload_invoice", {
			method: "POST",
			headers: { "X-Frappe-CSRF-Token": frappe.csrf_token },
			body: form_data,
		})
			.then((r) => r.json())
			.then((data) => {
				if (data.exc) {
					throw new Error(data._server_messages || data.exc);
				}
				return data.message || [];
			});
	}

	refresh_job_list() {
		frappe.call({
			method: "frappe.client.get_list",
			args: {
				doctype: "AI Document Import",
				fields: [
					"name", "company", "supplier", "extracted_supplier_name",
					"total", "status", "purchase_invoice",
					"source_file", "creation", "supplier_match_score"
				],
				order_by: "creation desc",
				limit: 50,
			},
		}).then((r) => {
			this._render_job_list(r.message || []);
		});
	}

	_render_job_list(rows) {
		const root = $(this.wrapper).find("#ai-importer-root");
		const count_el = root.find("#ai-job-count");
		const list_el = root.find("#ai-job-list");

		if (!rows.length) {
			count_el.text("");
			list_el.html(`<div style="padding:32px;text-align:center;color:#94a3b8;font-size:0.9em">
				No imports yet — upload a supplier invoice to get started.
			</div>`);
			return;
		}

		count_el.text(`Showing ${rows.length}`);

		const rows_html = rows.map((row) => {
			const file_icon = this._file_icon(row.source_file);
			const file_name = row.source_file
				? row.source_file.split("/").pop()
				: row.name;
			const supplier_cell = this._supplier_cell(row);
			const total_cell = row.total ? frappe.format(row.total, { fieldtype: "Currency" }) : "—";
			const status_badge = this._status_badge(row.status);
			const action_cell = this._action_cell(row);

			return `<tr style="border-bottom:1px solid #f1f5f9">
				<td style="padding:9px 12px;color:#374151">${file_icon} ${frappe.utils.escape_html(file_name)}</td>
				<td style="padding:9px 12px;color:#374151">${frappe.utils.escape_html(row.company || "—")}</td>
				<td style="padding:9px 12px">${supplier_cell}</td>
				<td style="padding:9px 12px;color:#374151">${total_cell}</td>
				<td style="padding:9px 12px">${status_badge}</td>
				<td style="padding:9px 12px">${action_cell}</td>
			</tr>`;
		}).join("");

		list_el.html(`
			<table style="width:100%;border-collapse:collapse;font-size:0.85em">
				<thead>
					<tr style="background:#f8fafc;text-align:left;font-size:0.8em;color:#64748b;text-transform:uppercase;letter-spacing:0.04em">
						<th style="padding:9px 12px;font-weight:500">File</th>
						<th style="padding:9px 12px;font-weight:500">Company</th>
						<th style="padding:9px 12px;font-weight:500">Supplier (matched)</th>
						<th style="padding:9px 12px;font-weight:500">Total</th>
						<th style="padding:9px 12px;font-weight:500">Status</th>
						<th style="padding:9px 12px;font-weight:500">Action</th>
					</tr>
				</thead>
				<tbody>${rows_html}</tbody>
			</table>
		`);
	}

	_file_icon(source_file) {
		if (!source_file) return "📄";
		const ext = source_file.split(".").pop().toLowerCase();
		if (ext === "zip") return "📦";
		if (["xlsx", "xls", "csv"].includes(ext)) return "📊";
		return "📄";
	}

	_supplier_cell(row) {
		if (!row.supplier) {
			if (row.extracted_supplier_name) {
				return `<span style="color:#dc2626">⚠ No match for "${frappe.utils.escape_html(row.extracted_supplier_name)}"</span>`;
			}
			return "—";
		}
		const score = row.supplier_match_score || 0;
		const color = score >= 85 ? "#16a34a" : score >= 60 ? "#d97706" : "#dc2626";
		return `<span style="color:${color}">${frappe.utils.escape_html(row.supplier)}</span>
			<span style="font-size:0.78em;color:#94a3b8;margin-left:4px">${score}%</span>`;
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
		const icons = {
			"Draft": "○",
			"Extracting": "⚙",
			"Pending Validation": "⏳",
			"Submitted": "✓",
			"Failed": "✕",
		};
		const icon = icons[status] || "";
		return `<span style="background:${s.bg};color:${s.color};padding:3px 10px;border-radius:4px;font-size:0.82em;white-space:nowrap">
			${icon} ${status}
		</span>`;
	}

	_action_cell(row) {
		if (row.status === "Submitted" && row.purchase_invoice) {
			const url = frappe.utils.get_form_link("Purchase Invoice", row.purchase_invoice);
			return `<a href="${url}" style="color:#4f46e5;font-size:0.85em">${frappe.utils.escape_html(row.purchase_invoice)}</a>`;
		}
		if (row.status === "Pending Validation" || row.status === "Failed") {
			const url = "/app/ai-invoice-validate/" + encodeURIComponent(row.name);
			const label = row.status === "Failed" ? "View →" : "Validate →";
			return `<a href="${url}" style="color:#4f46e5;font-size:0.85em">${label}</a>`;
		}
		if (row.status === "Extracting") {
			return `<span style="color:#64748b;font-size:0.82em">Processing…</span>`;
		}
		const url = "/app/ai-invoice-validate/" + encodeURIComponent(row.name);
		return `<a href="${url}" style="color:#64748b;font-size:0.85em">View →</a>`;
	}

	_start_auto_refresh() {
		this.job_list_interval = setInterval(() => {
			this.refresh_job_list();
		}, 10000);
	}
}
