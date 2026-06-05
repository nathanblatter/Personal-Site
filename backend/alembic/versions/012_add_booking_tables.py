"""add booking tables

Revision ID: 006_booking
Revises: 005_about_gpa
Create Date: 2026-06-04
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "012_booking"
down_revision = "011_blog_views"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "availability_windows",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("day_of_week", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.String(), nullable=False),
        sa.Column("end_time", sa.String(), nullable=False),
        sa.Column("allowed_durations", sa.JSON(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "date_overrides",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("reason", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("date"),
    )

    # Create the enum type first
    bookingstatus = postgresql.ENUM("pending", "confirmed", "declined", "cancelled", name="bookingstatus", create_type=False)
    bookingstatus.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "bookings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("visitor_name", sa.String(), nullable=False),
        sa.Column("visitor_email", sa.String(), nullable=False),
        sa.Column("topic", sa.String(), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("status", bookingstatus, nullable=False, server_default="pending"),
        sa.Column("zoom_join_url", sa.String(), nullable=True),
        sa.Column("zoom_meeting_id", sa.String(), nullable=True),
        sa.Column("admin_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "booking_settings",
        sa.Column("id", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("timezone", sa.String(), nullable=False, server_default="America/Denver"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("booking_settings")
    op.drop_table("bookings")
    op.drop_table("date_overrides")
    op.drop_table("availability_windows")
    sa.Enum(name="bookingstatus").drop(op.get_bind(), checkfirst=True)
