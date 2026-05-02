frappe.ui.form.on("AI Document Import", {
    refresh(frm) {
        frm.disable_save();
        _render_supplier_confidence(frm);
        _add_action_buttons(frm);
        _highlight_low_confidence_items(frm);
    },
});

frappe.ui.form.on("AI Document Import Item", {
    item_code(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        if (row.item_code) {
            frappe.model.set_value(cdt, cdn, "manually_mapped", 1);
        }
    },
});

function _render_supplier_confidence(frm) {
    if (!frm.doc.extracted_supplier_name) return;
    const score = frm.doc.supplier_match_score || 0;
    const color = score >= 85 ? "#16a34a" : score >= 60 ? "#d97706" : "#dc2626";
    const msg = `<span style="color:${color}">Match: <b>${score}%</b> — AI extracted: "<i>${frm.doc.extracted_supplier_name}</i>"</span>`;
    frm.get_field("party").set_description(msg);
}

function _highlight_low_confidence_items(frm) {
    const threshold = 70;
    (frm.doc.items || []).forEach((item) => {
        if ((item.item_match_score || 0) < threshold && !item.item_code) {
            const row_name = item.name;
            frm.fields_dict.items.grid.get_row(row_name).$row.css("background", "#fffbeb");
        }
    });
}

function _add_action_buttons(frm) {
    if (frm.doc.status === "Pending Validation") {
        frm.add_custom_button(__("Create Purchase Invoice"), () => _submit(frm))
            .addClass("btn-primary");

        frm.add_custom_button(__("Re-extract"), () => {
            frappe.confirm(
                "Re-run AI extraction? All current extracted data will be overwritten.",
                () => {
                    frappe.call({
                        method: "erpnext_ai_importer.api.extract.reextract",
                        args: { import_name: frm.doc.name },
                        callback() {
                            frappe.show_alert({ message: "Extraction queued — refresh in a moment.", indicator: "blue" });
                            setTimeout(() => frm.reload_doc(), 3000);
                        },
                    });
                }
            );
        });
    }

    if (frm.doc.status === "Submitted" && frm.doc.purchase_invoice) {
        frm.add_custom_button(__("View Purchase Invoice"), () => {
            frappe.set_route("Form", "Purchase Invoice", frm.doc.purchase_invoice);
        }).addClass("btn-default");
    }

    if (frm.doc.status === "Draft") {
        frm.add_custom_button(__("Extract Now"), () => {
            frappe.call({
                method: "erpnext_ai_importer.api.extract.reextract",
                args: { import_name: frm.doc.name },
                callback() {
                    frappe.show_alert({ message: "Extraction queued.", indicator: "blue" });
                    setTimeout(() => frm.reload_doc(), 3000);
                },
            });
        }).addClass("btn-primary");
    }
}

function _submit(frm) {
    const score = frm.doc.supplier_match_score || 0;
    if (!frm.doc.party) {
        frappe.msgprint({ title: "Missing Supplier", message: "Please select a supplier before submitting.", indicator: "red" });
        return;
    }
    if (score < 60) {
        frappe.msgprint({
            title: "Low Supplier Confidence",
            message: `Supplier match is only ${score}%. Please verify the supplier field before submitting.`,
            indicator: "red",
        });
        return;
    }
    const unmapped = (frm.doc.items || []).filter(i => !i.item_code);
    if (unmapped.length > 0) {
        frappe.msgprint({
            title: "Unmapped Items",
            message: `${unmapped.length} item(s) still need to be mapped. Use the dropdown in each row to select or create an item.`,
            indicator: "orange",
        });
        return;
    }

    const total = format_currency(frm.doc.total, frm.doc.currency);
    frappe.confirm(
        `Create Purchase Invoice for <b>${frm.doc.party}</b>?<br>Total: <b>${total}</b>`,
        () => {
            frappe.call({
                method: "erpnext_ai_importer.api.submit.create_purchase_invoice",
                args: { import_name: frm.doc.name },
                freeze: true,
                freeze_message: "Creating Purchase Invoice...",
                callback(r) {
                    if (!r.exc) {
                        frappe.show_alert({ message: `Purchase Invoice ${r.message} created`, indicator: "green" });
                        frm.reload_doc();
                    }
                },
            });
        }
    );
}
