"""add consulting CRM tables + backfill contacts

Revision ID: 014_crm
Revises: 013_reminder
Create Date: 2026-06-12
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "014_crm"
down_revision = "013_reminder"
branch_labels = None
depends_on = None


UUID = postgresql.UUID
_uuid_default = sa.text("uuid_generate_v4()")


def _enum(name):
    return postgresql.ENUM(name=name, create_type=False)


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')

    # ── Enum types ────────────────────────────────────────────────────────────
    op.execute("CREATE TYPE crm_contact_source AS ENUM ('contact_form','booking','testimonial','manual','referral','other');")
    op.execute("CREATE TYPE crm_deal_stage AS ENUM ('lead','qualified','proposal','negotiation','won','lost');")
    op.execute("CREATE TYPE crm_engagement_status AS ENUM ('active','paused','completed','cancelled');")
    op.execute("CREATE TYPE crm_billing_type AS ENUM ('hourly','fixed','retainer');")
    op.execute("CREATE TYPE crm_contract_status AS ENUM ('draft','sent','accepted','declined','void');")
    op.execute("CREATE TYPE crm_invoice_status AS ENUM ('draft','sent','paid','partial','overdue','void');")
    op.execute("CREATE TYPE crm_payment_method AS ENUM ('venmo','zelle','cash','check','stripe','other');")
    op.execute("CREATE TYPE crm_activity_type AS ENUM ('note','email','call','meeting','contact_form','booking','status_change');")

    # ── Organizations ─────────────────────────────────────────────────────────
    op.create_table(
        "crm_organization",
        sa.Column("id", UUID(), server_default=_uuid_default, nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("website_url", sa.String(), nullable=True),
        sa.Column("industry", sa.String(), nullable=True),
        sa.Column("logo_url", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── Contacts ──────────────────────────────────────────────────────────────
    op.create_table(
        "crm_contact",
        sa.Column("id", UUID(), server_default=_uuid_default, nullable=False),
        sa.Column("organization_id", UUID(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("company_name", sa.String(), nullable=True),
        sa.Column("source", _enum("crm_contact_source"), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["crm_organization.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_crm_contact_email", "crm_contact", ["email"])

    # ── Deals ─────────────────────────────────────────────────────────────────
    op.create_table(
        "crm_deal",
        sa.Column("id", UUID(), server_default=_uuid_default, nullable=False),
        sa.Column("contact_id", UUID(), nullable=False),
        sa.Column("organization_id", UUID(), nullable=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("stage", _enum("crm_deal_stage"), nullable=False, server_default="lead"),
        sa.Column("value_cents", sa.BigInteger(), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="USD"),
        sa.Column("expected_close_date", sa.Date(), nullable=True),
        sa.Column("source", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("won_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("lost_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["contact_id"], ["crm_contact.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organization_id"], ["crm_organization.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── Engagements ───────────────────────────────────────────────────────────
    op.create_table(
        "crm_engagement",
        sa.Column("id", UUID(), server_default=_uuid_default, nullable=False),
        sa.Column("contact_id", UUID(), nullable=False),
        sa.Column("organization_id", UUID(), nullable=True),
        sa.Column("deal_id", UUID(), nullable=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("status", _enum("crm_engagement_status"), nullable=False, server_default="active"),
        sa.Column("billing_type", _enum("crm_billing_type"), nullable=False, server_default="hourly"),
        sa.Column("rate_cents", sa.BigInteger(), nullable=True),
        sa.Column("fixed_amount_cents", sa.BigInteger(), nullable=True),
        sa.Column("retainer_amount_cents", sa.BigInteger(), nullable=True),
        sa.Column("retainer_period", sa.String(), nullable=True, server_default="monthly"),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="USD"),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["contact_id"], ["crm_contact.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organization_id"], ["crm_organization.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["deal_id"], ["crm_deal.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── Contracts ─────────────────────────────────────────────────────────────
    op.create_table(
        "crm_contract",
        sa.Column("id", UUID(), server_default=_uuid_default, nullable=False),
        sa.Column("engagement_id", UUID(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("scope_md", sa.Text(), nullable=True),
        sa.Column("terms_md", sa.Text(), nullable=True),
        sa.Column("total_value_cents", sa.BigInteger(), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="USD"),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("status", _enum("crm_contract_status"), nullable=False, server_default="draft"),
        sa.Column("file_url", sa.String(), nullable=True),
        sa.Column("public_token", sa.String(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("accepted_name", sa.String(), nullable=True),
        sa.Column("accepted_ip", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["engagement_id"], ["crm_engagement.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("public_token"),
    )

    # ── Invoices ──────────────────────────────────────────────────────────────
    op.create_table(
        "crm_invoice",
        sa.Column("id", UUID(), server_default=_uuid_default, nullable=False),
        sa.Column("engagement_id", UUID(), nullable=False),
        sa.Column("contact_id", UUID(), nullable=True),
        sa.Column("organization_id", UUID(), nullable=True),
        sa.Column("number", sa.String(), nullable=False),
        sa.Column("status", _enum("crm_invoice_status"), nullable=False, server_default="draft"),
        sa.Column("issue_date", sa.Date(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="USD"),
        sa.Column("subtotal_cents", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("tax_cents", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("total_cents", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("amount_paid_cents", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("is_retainer", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("period_start", sa.Date(), nullable=True),
        sa.Column("period_end", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("public_token", sa.String(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["engagement_id"], ["crm_engagement.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["contact_id"], ["crm_contact.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["organization_id"], ["crm_organization.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("number"),
        sa.UniqueConstraint("public_token"),
    )

    # ── Invoice line items ────────────────────────────────────────────────────
    op.create_table(
        "crm_invoice_line_item",
        sa.Column("id", UUID(), server_default=_uuid_default, nullable=False),
        sa.Column("invoice_id", UUID(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("quantity", sa.Numeric(10, 2), nullable=False, server_default="1"),
        sa.Column("unit_price_cents", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("amount_cents", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.ForeignKeyConstraint(["invoice_id"], ["crm_invoice.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── Payments ──────────────────────────────────────────────────────────────
    op.create_table(
        "crm_payment",
        sa.Column("id", UUID(), server_default=_uuid_default, nullable=False),
        sa.Column("invoice_id", UUID(), nullable=False),
        sa.Column("amount_cents", sa.BigInteger(), nullable=False),
        sa.Column("method", _enum("crm_payment_method"), nullable=True),
        sa.Column("reference", sa.String(), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["invoice_id"], ["crm_invoice.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── Time entries ──────────────────────────────────────────────────────────
    op.create_table(
        "crm_time_entry",
        sa.Column("id", UUID(), server_default=_uuid_default, nullable=False),
        sa.Column("engagement_id", UUID(), nullable=False),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("minutes", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("billable", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("rate_cents_override", sa.BigInteger(), nullable=True),
        sa.Column("invoice_id", UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["engagement_id"], ["crm_engagement.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["invoice_id"], ["crm_invoice.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── Activities ────────────────────────────────────────────────────────────
    op.create_table(
        "crm_activity",
        sa.Column("id", UUID(), server_default=_uuid_default, nullable=False),
        sa.Column("contact_id", UUID(), nullable=False),
        sa.Column("engagement_id", UUID(), nullable=True),
        sa.Column("type", _enum("crm_activity_type"), nullable=False, server_default="note"),
        sa.Column("body_md", sa.Text(), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["contact_id"], ["crm_contact.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["engagement_id"], ["crm_engagement.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── Link existing tables ──────────────────────────────────────────────────
    op.add_column("bookings", sa.Column("contact_id", UUID(), nullable=True))
    op.create_foreign_key("fk_bookings_contact", "bookings", "crm_contact", ["contact_id"], ["id"], ondelete="SET NULL")
    op.add_column("testimonial_requests", sa.Column("contact_id", UUID(), nullable=True))
    op.create_foreign_key("fk_treq_contact", "testimonial_requests", "crm_contact", ["contact_id"], ["id"], ondelete="SET NULL")

    # ── Backfill: unify existing people into contacts (de-dupe by email) ──────
    # Bookings → contacts
    op.execute("""
        INSERT INTO crm_contact (id, name, email, source, tags, created_at, updated_at)
        SELECT uuid_generate_v4(), MIN(b.visitor_name), MIN(b.visitor_email),
               'booking'::crm_contact_source, '[]'::json, now(), now()
        FROM bookings b
        WHERE b.visitor_email IS NOT NULL AND b.visitor_email <> ''
          AND NOT EXISTS (SELECT 1 FROM crm_contact c WHERE LOWER(c.email) = LOWER(b.visitor_email))
        GROUP BY LOWER(b.visitor_email);
    """)
    op.execute("""
        UPDATE bookings b SET contact_id = c.id
        FROM crm_contact c
        WHERE LOWER(c.email) = LOWER(b.visitor_email) AND b.contact_id IS NULL;
    """)
    # Testimonial requests → contacts (reuse existing where email already present)
    op.execute("""
        INSERT INTO crm_contact (id, name, email, title, source, tags, created_at, updated_at)
        SELECT uuid_generate_v4(), MIN(t.requester_name), MIN(t.requester_email), MIN(t.requester_role),
               'testimonial'::crm_contact_source, '[]'::json, now(), now()
        FROM testimonial_requests t
        WHERE t.requester_email IS NOT NULL AND t.requester_email <> ''
          AND NOT EXISTS (SELECT 1 FROM crm_contact c WHERE LOWER(c.email) = LOWER(t.requester_email))
        GROUP BY LOWER(t.requester_email);
    """)
    op.execute("""
        UPDATE testimonial_requests t SET contact_id = c.id
        FROM crm_contact c
        WHERE LOWER(c.email) = LOWER(t.requester_email) AND t.contact_id IS NULL;
    """)


def downgrade() -> None:
    op.drop_constraint("fk_treq_contact", "testimonial_requests", type_="foreignkey")
    op.drop_column("testimonial_requests", "contact_id")
    op.drop_constraint("fk_bookings_contact", "bookings", type_="foreignkey")
    op.drop_column("bookings", "contact_id")

    for tbl in [
        "crm_activity", "crm_time_entry", "crm_payment", "crm_invoice_line_item",
        "crm_invoice", "crm_contract", "crm_engagement", "crm_deal", "crm_contact", "crm_organization",
    ]:
        op.drop_table(tbl)

    for enum_name in [
        "crm_activity_type", "crm_payment_method", "crm_invoice_status", "crm_contract_status",
        "crm_billing_type", "crm_engagement_status", "crm_deal_stage", "crm_contact_source",
    ]:
        op.execute(f"DROP TYPE IF EXISTS {enum_name};")
