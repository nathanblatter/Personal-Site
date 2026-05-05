"""Add tracked_links table

Revision ID: 007_tracked_links
Revises: 006_extras
Create Date: 2026-05-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "007_tracked_links"
down_revision: Union[str, None] = "006_extras"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tracked_links",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("slug", sa.String(), unique=True, index=True, nullable=False),
        sa.Column("destination_url", sa.String(), nullable=False),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("clicks", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_table("tracked_links")
