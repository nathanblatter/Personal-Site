"""Add claude_usage_days table for persisting historical usage

Revision ID: 010_claude_usage_snapshots
Revises: 009_testimonial_requests
Create Date: 2026-05-29
"""
from alembic import op
import sqlalchemy as sa

revision = "010_claude_usage_snapshots"
down_revision = "009_testimonial_requests"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "claude_usage_days",
        sa.Column("date", sa.String(), primary_key=True),
        sa.Column("tokens", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("cost_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sessions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("snapshotted_at", sa.String(), nullable=False),
    )


def downgrade():
    op.drop_table("claude_usage_days")
