"""Add testimonial_requests table

Revision ID: 009_testimonial_requests
Revises: 008_portfolio_ctx
Create Date: 2026-05-19
"""
from alembic import op
import sqlalchemy as sa

revision = "009_testimonial_requests"
down_revision = "008_portfolio_ctx"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "testimonial_requests",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("slug", sa.String(), nullable=False, unique=True, index=True),
        sa.Column("requester_name", sa.String(), nullable=False),
        sa.Column("requester_email", sa.String(), nullable=True),
        sa.Column("requester_role", sa.String(), nullable=True),
        sa.Column("personal_message", sa.Text(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("submitted_name", sa.String(), nullable=True),
        sa.Column("submitted_role", sa.String(), nullable=True),
        sa.Column("submitted_quote", sa.Text(), nullable=True),
        sa.Column("submitted_avatar_url", sa.String(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("submitted_at", sa.String(), nullable=True),
        sa.Column("reviewed_at", sa.String(), nullable=True),
        sa.Column("testimonial_id", sa.Integer(), sa.ForeignKey("testimonials.id", ondelete="SET NULL"), nullable=True),
    )


def downgrade():
    op.drop_table("testimonial_requests")
