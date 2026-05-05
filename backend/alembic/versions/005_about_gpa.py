"""Add gpa column to about

Revision ID: 005_about_gpa
Revises: 004_project_images
Create Date: 2026-05-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "005_about_gpa"
down_revision: Union[str, None] = "004_project_images"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("about", sa.Column("gpa", sa.String(), nullable=True))
    op.execute("UPDATE about SET gpa = '3.64' WHERE id = 1")


def downgrade() -> None:
    op.drop_column("about", "gpa")
