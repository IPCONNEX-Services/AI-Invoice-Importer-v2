frappe.pages["telecom-invoice-match"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: "Telecom Invoice Match",
		single_column: true,
	});

	frappe.dom.set_style(`
		.tim-root {
			--blue:#0B70E1; --blue-dk:#0958B3; --blue-lt:#E8F2FF;
			--navy:#0B1D3A; --border:#D8E4F0; --bg:#F4F7FB; --surface:#FFFFFF;
			--text:#0B1D3A; --text-sub:#5A7A9A; --text-muted:#9BB5CC;
			--ok:#0D7C3D; --ok-bg:#EAF7EE; --ok-bd:#A7D7BA;
			--err:#C7201A; --err-bg:#FDECEA;
			--warn:#A85A00; --warn-bg:#FFF3E0;
			--r-sm:6px; --r-md:10px;
			--sh-sm:0 1px 4px rgba(11,29,58,.07);
			max-width:1100px; margin:0 auto; padding:20px 16px 60px;
			font-family:'Inter','Segoe UI',-apple-system,sans-serif;
		}
		.tim-back { font-size:12px; color:var(--blue); cursor:pointer; margin-bottom:16px; display:inline-block; }
		.tim-back:hover { text-decoration:underline; }
		.tim-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px; }
		.tim-card {
			background:var(--surface); border:1px solid var(--border);
			border-radius:var(--r-md); overflow:hidden; box-shadow:var(--sh-sm);
		}
		.tim-card-head {
			display:flex; justify-content:space-between; align-items:center;
			padding:10px 14px; background:var(--bg); border-bottom:1px solid var(--border);
		}
		.tim-card-title { font-size:12px; font-weight:700; color:var(--text); text-transform:uppercase; letter-spacing:.04em; }
		.tim-card-sub { font-size:11px; color:var(--text-muted); }
		.tim-kv { padding:14px; display:grid; grid-template-columns:120px 1fr; gap:6px 10px; font-size:12px; }
		.tim-kv-label { color:var(--text-muted); font-weight:600; }
		.tim-kv-val { color:var(--text); word-break:break-all; }
		.tim-amount { font-size:22px; font-weight:700; color:var(--navy); }
		.tim-gap-bar {
			background:var(--surface); border:2px solid var(--border);
			border-radius:var(--r-md); padding:20px 24px; margin-bottom:20px;
			display:flex; align-items:center; justify-content:space-between; gap:20px;
			box-shadow:var(--sh-sm);
		}
		.tim-gap-ok  { border-color:var(--ok-bd); background:var(--ok-bg); }
		.tim-gap-warn { border-color:#f5c77e; background:var(--warn-bg); }
		.tim-gap-err  { border-color:#f5aaaa; background:var(--err-bg); }
		.tim-gap-number { font-size:32px; font-weight:800; }
		.tim-gap-ok  .tim-gap-number { color:var(--ok); }
		.tim-gap-warn .tim-gap-number { color:var(--warn); }
		.tim-gap-err  .tim-gap-number { color:var(--err); }
		.tim-gap-label { font-size:12px; color:var(--text-sub); margin-top:2px; }
		.tim-gap-detail { font-size:13px; color:var(--text); }
		.tim-candidates {
			background:var(--surface); border:1px solid var(--border);
			border-radius:var(--r-md); overflow:hidden; box-shadow:var(--sh-sm); margin-bottom:20px;
		}
		.tim-cand-head {
			padding:10px 14px; background:var(--bg); border-bottom:1px solid var(--border);
			font-size:12px; font-weight:700; color:var(--text); text-transform:uppercase; letter-spacing:.04em;
		}
		.tim-cand-row {
			display:grid; grid-template-columns:20px 1fr 110px 110px 80px 80px;
			gap:0 12px; align-items:center;
			padding:10px 14px; border-bottom:1px solid var(--bg);
			font-size:12px; cursor:pointer;
		}
		.tim-cand-row:last-child { border-bottom:none; }
		.tim-cand-row:hover { background:var(--blue-lt); }
		.tim-cand-row.selected { background:var(--blue-lt); outline:2px solid var(--blue); outline-offset:-2px; border-radius:4px; }
		.tim-radio { width:14px; height:14px; accent-color:var(--blue); cursor:pointer; }
		.tim-cand-name { font-weight:600; color:var(--navy); }
		.tim-cand-amt { font-weight:600; color:var(--text); text-align:right; }
		.tim-cand-gap { text-align:right; }
		.tim-badge {
			display:inline-block; padding:2px 7px; border-radius:var(--r-sm);
			font-size:10px; font-weight:700; white-space:nowrap;
		}
		.tim-badge-ok   { background:var(--ok-bg);   color:var(--ok); }
		.tim-badge-warn { background:var(--warn-bg); color:var(--warn); }
		.tim-badge-err  { background:var(--err-bg);  color:var(--err); }
		.tim-action-bar { display:flex; gap:10px; align-items:center; flex-wrap:wrap; padding:16px 0; }
		.tim-btn {
			padding:9px 20px; border-radius:var(--r-sm); border:none; cursor:pointer;
			font-size:13px; font-weight:600; transition:opacity .15s;
		}
		.tim-btn:hover { opacity:.85; }
		.tim-btn-primary   { background:var(--blue); color:#fff; }
		.tim-btn-secondary { background:var(--bg); color:var(--text); border:1px solid var(--border); }
		.tim-btn-success   { background:var(--ok); color:#fff; }
		.tim-btn:disabled  { opacity:.45; cursor:not-allowed; }
		.tim-override { display:none; margin-top:4px; }
		.tim-override textarea {
			width:100%; border:1px solid var(--border); border-radius:var(--r-sm);
			padding:8px 10px; font-size:12px; resize:vertical; min-height:60px; font-family:inherit;
		}
		.tim-msg { padding:10px 14px; border-radius:var(--r-sm); font-size:12px; margin-bottom:12px; }
		.tim-msg-ok  { background:var(--ok-bg);  color:var(--ok);  border:1px solid var(--ok-bd); }
		.tim-msg-err { background:var(--err-bg); color:var(--err); border:1px solid #f5aaaa; }
		.tim-loading { padding:40px; text-align:center; color:var(--text-muted); font-size:13px; }
		.tim-empty   { padding:30px; text-align:center; color:var(--text-muted); font-size:13px; }
	`);

	const $body = $(wrapper).find(".page-content");
	$body.html(`<div class="tim-root"><div class="tim-loading">Loading…</div></div>`);
	const $root = $body.find(".tim-root");

	const params = new URLSearchParams(location.search);
	const importName = params.get("import");

	if (!importName) {
		$root.html(`<div class="tim-empty">No import specified. Open from the AI Invoice validate page.</div>`);
		return;
	}

	const state = { data: null, selectedAnchor: null };

	function load() {
		frappe.call({
			method: "erpnext_ai_importer.api.match.find_ixc_candidates",
			args: { import_name: importName },
		}).then(r => {
			state.data = r.message;
			const candidates = state.data.candidates || [];
			if (candidates.length) {
				const sorted = [...candidates].sort((a, b) => a.gap_pct - b.gap_pct);
				state.selectedAnchor = sorted[0].bill_id;
			}
			render();
		});
	}

	function gapClass(pct) {
		if (pct < 1)  return "ok";
		if (pct < 10) return "warn";
		return "err";
	}

	function badgeClass(pct) {
		if (pct < 1)  return "tim-badge-ok";
		if (pct < 10) return "tim-badge-warn";
		return "tim-badge-err";
	}

	function fmtAmt(v, currency) {
		return frappe.format(v, { fieldtype: "Currency", currency: currency || "USD" });
	}

	function render() {
		const d = state.data;
		const imp = d.import;
		const candidates = d.candidates || [];
		const sel = candidates.find(c => c.bill_id === state.selectedAnchor);
		const gap = sel ? sel.gap_pct : null;
		const gapCls = gap !== null ? gapClass(gap) : "err";
		const cur = imp.currency || "USD";

		// gap bar
		let gapBar;
		if (sel) {
			gapBar = `
			<div class="tim-gap-bar tim-gap-${gapCls}">
				<div>
					<div class="tim-gap-number">${gap.toFixed(2)}%</div>
					<div class="tim-gap-label">Gap — PDF invoice vs IXC bilateral</div>
				</div>
				<div class="tim-gap-detail">
					PDF <strong>${fmtAmt(imp.total, cur)}</strong> &nbsp;·&nbsp;
					IXC <strong>${fmtAmt(sel.grand_total, cur)}</strong> &nbsp;·&nbsp;
					Diff <strong>${fmtAmt(sel.gap_amount, cur)}</strong>
				</div>
				<div>
					${gap < 1
						? `<span class="tim-badge tim-badge-ok">✓ Auto-approvable</span>`
						: `<span class="tim-badge tim-badge-${gapCls}">⚠ ${gap.toFixed(1)}% — manual review</span>`}
				</div>
			</div>`;
		} else {
			gapBar = `
			<div class="tim-gap-bar tim-gap-err">
				<div class="tim-gap-number">—</div>
				<div class="tim-gap-label">Select an IXC anchor below</div>
			</div>`;
		}

		// candidates
		let candidateRows;
		if (!candidates.length) {
			candidateRows = `<div class="tim-empty">No IXC bilateral draft PIs found for <strong>${frappe.utils.escape_html(imp.supplier || "")}</strong>.</div>`;
		} else {
			candidateRows = candidates.map(c => {
				const isSel = c.bill_id === state.selectedAnchor;
				return `
				<div class="tim-cand-row${isSel ? " selected" : ""}" data-name="${frappe.utils.escape_html(c.bill_id)}">
					<input type="radio" class="tim-radio" name="anchor"
						value="${frappe.utils.escape_html(c.bill_id)}" ${isSel ? "checked" : ""}>
					<span class="tim-cand-name">${frappe.utils.escape_html(c.payee || c.name)}</span>
					<span style="color:var(--text-sub);font-size:11px">${c.date || c.posting_date || ""}</span>
					<span class="tim-cand-amt">${fmtAmt(c.grand_total, cur)}</span>
					<span style="color:var(--text-sub);font-size:11px;text-align:right">
						${c.comment ? c.comment.substring(0, 30) : (c.bill_id ? "Bill #" + c.bill_id : "")}
					</span>
					<span class="tim-cand-gap">
						<span class="tim-badge ${badgeClass(c.gap_pct)}">${c.gap_pct.toFixed(1)}%</span>
					</span>
				</div>`;
			}).join("");
		}

		const canSubmit = sel && gap < 1;
		const submitBtn = canSubmit
			? `<button class="tim-btn tim-btn-success" id="tim-submit">✓ Submit Telecom Invoice</button>`
			: `<button class="tim-btn tim-btn-primary" id="tim-submit" disabled>Submit (gap ≥ 1%)</button>`;
		const overrideBtn = (sel && gap >= 1)
			? `<button class="tim-btn tim-btn-secondary" id="tim-show-override">Override — submit with note</button>`
			: "";

		$root.html(`
			<a class="tim-back" href="/app/ai-invoice-validate/${encodeURIComponent(importName)}">← Back to Import</a>

			<div class="tim-grid">
				<div class="tim-card">
					<div class="tim-card-head">
						<span class="tim-card-title">PDF Invoice (from supplier)</span>
						<span class="tim-card-sub">${frappe.utils.escape_html(imp.name)}</span>
					</div>
					<div class="tim-kv">
						<span class="tim-kv-label">Supplier</span>
						<span class="tim-kv-val">${frappe.utils.escape_html(imp.supplier || "—")}</span>
						<span class="tim-kv-label">Invoice #</span>
						<span class="tim-kv-val">${frappe.utils.escape_html(imp.invoice_number || "—")}</span>
						<span class="tim-kv-label">Date</span>
						<span class="tim-kv-val">${imp.invoice_date || "—"}</span>
						<span class="tim-kv-label">Total</span>
						<span class="tim-kv-val"><span class="tim-amount">${fmtAmt(imp.total, cur)}</span></span>
					</div>
				</div>

				<div class="tim-card">
					<div class="tim-card-head">
						<span class="tim-card-title">IXC Bilateral Anchor</span>
						<span class="tim-card-sub">${sel ? "IXC Bill #" + frappe.utils.escape_html(sel.bill_id || "") : "none selected"}</span>
					</div>
					<div class="tim-kv">
						<span class="tim-kv-label">Supplier</span>
						<span class="tim-kv-val">${frappe.utils.escape_html(imp.supplier || "—")}</span>
						<span class="tim-kv-label">IXC Bill #</span>
						<span class="tim-kv-val">${sel ? (sel.bill_id || "—") : "—"}</span>
						<span class="tim-kv-label">Date</span>
						<span class="tim-kv-val">${sel ? (sel.date || sel.posting_date || "—") : "—"}</span>
						<span class="tim-kv-label">Total</span>
						<span class="tim-kv-val"><span class="tim-amount">${sel ? fmtAmt(sel.grand_total, cur) : "—"}</span></span>
					</div>
				</div>
			</div>

			${gapBar}

			<div class="tim-candidates">
				<div class="tim-cand-head">IXC Bilateral Draft PIs — select the matching one</div>
				${candidateRows}
			</div>

			<div id="tim-feedback"></div>

			<div class="tim-action-bar">
				${submitBtn}
				${overrideBtn}
				<a class="tim-btn tim-btn-secondary"
					href="/app/ai-invoice-validate/${encodeURIComponent(importName)}">Cancel</a>
			</div>

			<div class="tim-override" id="tim-override-section">
				<div style="font-size:12px;color:var(--text-sub);margin-bottom:4px;">
					Override note (required when gap ≥ 1%)
				</div>
				<textarea id="tim-override-note"
					placeholder="Explain why the gap is acceptable…"></textarea>
				<div class="tim-action-bar" style="padding-top:8px;">
					<button class="tim-btn tim-btn-primary" id="tim-submit-override">
						Submit with Override
					</button>
				</div>
			</div>
		`);

		bindEvents();
	}

	function bindEvents() {
		$root.on("click", ".tim-cand-row", function () {
			state.selectedAnchor = $(this).data("name");
			render();
		});

		$root.on("click", "#tim-show-override", function () {
			$root.find("#tim-override-section").show();
			$(this).hide();
		});

		$root.on("click", "#tim-submit", function () {
			doSubmit(state.selectedAnchor, null);
		});

		$root.on("click", "#tim-submit-override", function () {
			const note = $root.find("#tim-override-note").val().trim();
			if (!note) { frappe.msgprint("Please enter an override note.", "Validation"); return; }
			doSubmit(state.selectedAnchor, note);
		});
	}

	function doSubmit(anchorPi, overrideNote) {
		$root.find("#tim-submit, #tim-submit-override").prop("disabled", true).text("Submitting…");
		frappe.call({
			method: "erpnext_ai_importer.api.match.submit_telecom_invoice",
			args: {
				import_name: importName,
				ixc_bill_id: anchorPi,
				override_note: overrideNote || null,
			},
		}).then(r => {
			const result = r.message;
			const piUrl = frappe.utils.get_form_link("Purchase Invoice", result.purchase_invoice);
			$root.find("#tim-feedback").html(`
				<div class="tim-msg tim-msg-ok">
					✓ <a href="${piUrl}">${frappe.utils.escape_html(result.purchase_invoice)}</a> created
					· IXC Bill <strong>#${frappe.utils.escape_html(anchorPi)}</strong>.
					Gap: ${result.gap_pct.toFixed(2)}%.
					<a href="/app/ai-importer" style="margin-left:12px;color:var(--blue);">← Back to importer</a>
				</div>
			`);
			$root.find(".tim-action-bar, .tim-override").hide();
		}).catch(() => {
			$root.find("#tim-submit, #tim-submit-override").prop("disabled", false);
		});
	}

	load();
};
