import frappe


def execute():
    """
    Post-model-sync: backfill new fields on rows created before the
    generalization. Sets Purchase Invoice defaults so existing imports
    behave identically to before the rename.
    Idempotent — WHERE clause skips already-backfilled rows.
    """
    frappe.db.sql("""
        UPDATE `tabAI Document Import`
        SET
            document_type = 'Purchase Invoice',
            party_type    = 'Supplier',
            party         = supplier,
            source        = 'Manual Upload'
        WHERE document_type IS NULL OR document_type = ''
    """)
    frappe.db.commit()
