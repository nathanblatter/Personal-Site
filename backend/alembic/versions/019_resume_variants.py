"""resume variants (SWE / Data / AI flavors)

Revision ID: 019_resume_variants
Revises: 018_cert_group
Create Date: 2026-06-26
"""
from alembic import op
import sqlalchemy as sa

revision = "019_resume_variants"
down_revision = "018_cert_group"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "resume_variants",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("headline", sa.String(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("emphasis_tags", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_resume_variants_key", "resume_variants", ["key"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_resume_variants_key", table_name="resume_variants")
    op.drop_table("resume_variants")
