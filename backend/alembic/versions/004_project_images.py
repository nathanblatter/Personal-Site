"""Add images column to projects

Revision ID: 004_project_images
Revises: 003_internship_tracker
Create Date: 2026-05-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004_project_images"
down_revision: Union[str, None] = "003_internship_tracker"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("images", sa.JSON(), nullable=False, server_default="[]"))


def downgrade() -> None:
    op.drop_column("projects", "images")
