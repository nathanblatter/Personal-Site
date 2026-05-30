"""Add view_count to blog_posts

Revision ID: 011_blog_views
Revises: 010_claude_usage_snapshots
Create Date: 2026-05-30
"""
from alembic import op
import sqlalchemy as sa

revision = "011_blog_views"
down_revision = "010_claude_usage_snapshots"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "blog_posts",
        sa.Column("view_count", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade():
    op.drop_column("blog_posts", "view_count")
