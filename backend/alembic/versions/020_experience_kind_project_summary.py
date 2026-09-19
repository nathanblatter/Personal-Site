"""experience.kind + project.summary / demo_credentials

Revision ID: 020_exp_kind_proj_summary
Revises: 019_resume_variants
Create Date: 2026-09-18
"""
from alembic import op
import sqlalchemy as sa

revision = "020_exp_kind_proj_summary"
down_revision = "019_resume_variants"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("experience", sa.Column("kind", sa.String(), nullable=False, server_default="work"))
    op.add_column("projects", sa.Column("summary", sa.Text(), nullable=True))
    op.add_column("projects", sa.Column("demo_credentials", sa.String(), nullable=True))
    # Backfill: anything that looks like a degree is education.
    op.execute(
        "UPDATE experience SET kind = 'education' "
        "WHERE title ~* '\\m(B\\.S\\.|M\\.S\\.|B\\.A\\.|M\\.A\\.|Bachelor|Master|Ph\\.D\\.)'"
    )


def downgrade() -> None:
    op.drop_column("projects", "demo_credentials")
    op.drop_column("projects", "summary")
    op.drop_column("experience", "kind")
