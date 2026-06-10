"""add reminder_sent_at to bookings

Revision ID: 013_reminder
Revises: 012_booking
Create Date: 2026-06-06
"""
from alembic import op
import sqlalchemy as sa

revision = "013_reminder"
down_revision = "012_booking"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("bookings", sa.Column("reminder_sent_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("bookings", "reminder_sent_at")
