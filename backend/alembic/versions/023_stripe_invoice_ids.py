"""crm_contact.stripe_customer_id, crm_invoice.stripe_invoice_id (online invoice payment)

Revision ID: 023_stripe_invoice_ids
Revises: 022_about_hero
Create Date: 2026-11-25
"""
from alembic import op
import sqlalchemy as sa

revision = "023_stripe_invoice_ids"
down_revision = "022_about_hero"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("crm_contact", sa.Column("stripe_customer_id", sa.String(), nullable=True))
    op.add_column("crm_invoice", sa.Column("stripe_invoice_id", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("crm_invoice", "stripe_invoice_id")
    op.drop_column("crm_contact", "stripe_customer_id")
