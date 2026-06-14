"""add consultant signature fields to crm_contract

Revision ID: 015_contract_sig
Revises: 014_crm
Create Date: 2026-06-13
"""
from alembic import op
import sqlalchemy as sa

revision = "015_contract_sig"
down_revision = "014_crm"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("crm_contract", sa.Column("consultant_signed_name", sa.String(), nullable=True))
    op.add_column("crm_contract", sa.Column("consultant_signed_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("crm_contract", "consultant_signed_at")
    op.drop_column("crm_contract", "consultant_signed_name")
