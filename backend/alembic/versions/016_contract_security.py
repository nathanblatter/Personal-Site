"""contract tamper-evidence, audit trail, and email verification

Revision ID: 016_contract_sec
Revises: 015_contract_sig
Create Date: 2026-06-14
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "016_contract_sec"
down_revision = "015_contract_sig"
branch_labels = None
depends_on = None

UUID = postgresql.UUID


def upgrade() -> None:
    op.add_column("crm_contract", sa.Column("signer_email", sa.String(), nullable=True))
    op.add_column("crm_contract", sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("crm_contract", sa.Column("document_sha256", sa.String(), nullable=True))
    op.add_column("crm_contract", sa.Column("executed_pdf", sa.LargeBinary(), nullable=True))

    op.create_table(
        "crm_contract_event",
        sa.Column("id", UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("contract_id", UUID(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("actor_name", sa.String(), nullable=True),
        sa.Column("actor_email", sa.String(), nullable=True),
        sa.Column("ip", sa.String(), nullable=True),
        sa.Column("user_agent", sa.String(), nullable=True),
        sa.Column("meta", sa.JSON(), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["contract_id"], ["crm_contract.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_crm_contract_event_contract", "crm_contract_event", ["contract_id"])


def downgrade() -> None:
    op.drop_index("ix_crm_contract_event_contract", table_name="crm_contract_event")
    op.drop_table("crm_contract_event")
    op.drop_column("crm_contract", "executed_pdf")
    op.drop_column("crm_contract", "document_sha256")
    op.drop_column("crm_contract", "email_verified_at")
    op.drop_column("crm_contract", "signer_email")
