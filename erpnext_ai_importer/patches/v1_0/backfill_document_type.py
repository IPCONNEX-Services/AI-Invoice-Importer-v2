import frappe


def execute():
    """
    Post-model-sync: backfill new fields on rows created before the
    generalization. Sets Purchase Invoice defaults so existing imports
    behave identically to before the rename.
    Idempotent — WHERE clause skips already-backfilled rows.
    """
    # MariaDB applies column DEFAULTs to existing rows during ALTER TABLE ADD COLUMN,
    # so document_type and source are already populated before this patch runs.
    # Gate on party_type (no default) to correctly target un-backfilled rows.
    frappe.db.sql("""
        UPDATE `tabAI Document Import`
        SET
            party_type = 'Supplier',
            party      = supplier
        WHERE party_type IS NULL AND supplier IS NOT NULL
    """)
    frappe.db.commit()
