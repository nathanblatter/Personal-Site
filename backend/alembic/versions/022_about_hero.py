"""about.hero_tagline / hero_intro / meta_description

Revision ID: 022_about_hero
Revises: 021_exp_on_resume
Create Date: 2026-09-19
"""
from alembic import op
import sqlalchemy as sa

revision = "022_about_hero"
down_revision = "021_exp_on_resume"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("about", sa.Column("hero_tagline", sa.String(), nullable=True))
    op.add_column("about", sa.Column("hero_intro", sa.Text(), nullable=True))
    op.add_column("about", sa.Column("meta_description", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("about", "meta_description")
    op.drop_column("about", "hero_intro")
    op.drop_column("about", "hero_tagline")
