"""add portfolio_ctx to tracked_links

Revision ID: 008_portfolio_ctx
Revises: 007_tracked_links
Create Date: 2026-05-18
"""
from alembic import op
import sqlalchemy as sa

revision = "008_portfolio_ctx"
down_revision = "007_tracked_links"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("tracked_links", sa.Column("portfolio_ctx", sa.JSON(), nullable=True))


def downgrade():
    op.drop_column("tracked_links", "portfolio_ctx")
