"""experience.on_resume — timeline entries that stay off the résumé

Revision ID: 021_exp_on_resume
Revises: 020_exp_kind_proj_summary
Create Date: 2026-09-19
"""
from alembic import op
import sqlalchemy as sa

revision = "021_exp_on_resume"
down_revision = "020_exp_kind_proj_summary"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("experience", sa.Column("on_resume", sa.Boolean(), nullable=False, server_default=sa.true()))


def downgrade() -> None:
    op.drop_column("experience", "on_resume")
