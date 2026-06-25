"""certification grouping: category + featured

Revision ID: 018_cert_group
Revises: 017_crm_comms
Create Date: 2026-06-25
"""
from alembic import op
import sqlalchemy as sa

revision = "018_cert_group"
down_revision = "017_crm_comms"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("certifications", sa.Column("category", sa.String(), nullable=True))
    op.add_column(
        "certifications",
        sa.Column("featured", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("certifications", "featured")
    op.drop_column("certifications", "category")
