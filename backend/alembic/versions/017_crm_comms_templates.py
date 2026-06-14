"""contract decline + reminders + templates

Revision ID: 017_crm_comms
Revises: 016_contract_sec
Create Date: 2026-06-14
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "017_crm_comms"
down_revision = "016_contract_sec"
branch_labels = None
depends_on = None

UUID = postgresql.UUID


def upgrade() -> None:
    op.add_column("crm_contract", sa.Column("declined_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("crm_contract", sa.Column("declined_reason", sa.Text(), nullable=True))
    op.add_column("crm_contract", sa.Column("reminder_sent_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("crm_invoice", sa.Column("reminder_sent_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "crm_template",
        sa.Column("id", UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=True),
        sa.Column("scope_md", sa.Text(), nullable=True),
        sa.Column("terms_md", sa.Text(), nullable=True),
        sa.Column("total_value_cents", sa.BigInteger(), nullable=True),
        sa.Column("line_items", sa.JSON(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="USD"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("crm_template")
    op.drop_column("crm_invoice", "reminder_sent_at")
    op.drop_column("crm_contract", "reminder_sent_at")
    op.drop_column("crm_contract", "declined_reason")
    op.drop_column("crm_contract", "declined_at")
