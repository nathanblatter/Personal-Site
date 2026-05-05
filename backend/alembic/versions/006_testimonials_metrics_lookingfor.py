"""Add testimonials table, project metrics, about looking_for

Revision ID: 006_extras
Revises: 005_about_gpa
Create Date: 2026-05-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "006_extras"
down_revision: Union[str, None] = "005_about_gpa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "testimonials",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("quote", sa.Text(), nullable=False),
        sa.Column("avatar_url", sa.String(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("projects", sa.Column("metrics", sa.JSON(), nullable=False, server_default="[]"))
    op.add_column("about", sa.Column("looking_for", sa.JSON(), nullable=False, server_default="[]"))


def downgrade() -> None:
    op.drop_column("about", "looking_for")
    op.drop_column("projects", "metrics")
    op.drop_table("testimonials")
