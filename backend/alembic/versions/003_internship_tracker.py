"""Add internship/job application tracker tables

Revision ID: 003_internship_tracker
Revises: 002_blog
Create Date: 2026-04-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003_internship_tracker"
down_revision: Union[str, None] = "002_blog"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Extensions ───────────────────────────────────────────────────────────
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')

    # ── Enum types ───────────────────────────────────────────────────────────
    op.execute("""
        CREATE TYPE role_type AS ENUM (
            'internship', 'coop', 'new_grad', 'full_time', 'contract', 'part_time'
        );
    """)
    op.execute("""
        CREATE TYPE work_arrangement AS ENUM (
            'onsite', 'hybrid', 'remote'
        );
    """)
    op.execute("""
        CREATE TYPE application_status AS ENUM (
            'wishlist', 'drafting', 'applied', 'online_assessment',
            'recruiter_screen', 'phone_screen', 'technical', 'onsite',
            'final_round', 'offer', 'accepted', 'declined', 'rejected',
            'withdrawn', 'ghosted'
        );
    """)
    op.execute("""
        CREATE TYPE application_source AS ENUM (
            'linkedin', 'indeed', 'handshake', 'company_site', 'referral',
            'career_fair', 'recruiter_outreach', 'university_portal', 'other'
        );
    """)
    op.execute("""
        CREATE TYPE round_type AS ENUM (
            'online_assessment', 'recruiter_screen', 'phone_screen',
            'technical_phone', 'coding', 'system_design', 'behavioral',
            'take_home', 'pair_programming', 'onsite_loop', 'hiring_manager',
            'team_match', 'offer_call', 'other'
        );
    """)
    op.execute("""
        CREATE TYPE round_outcome AS ENUM (
            'pending', 'passed', 'failed', 'cancelled', 'no_show'
        );
    """)
    op.execute("""
        CREATE TYPE priority_tier AS ENUM (
            'dream', 'high', 'medium', 'low', 'backup'
        );
    """)

    # ── Tables ───────────────────────────────────────────────────────────────

    # company
    op.create_table(
        "company",
        sa.Column("id", sa.dialects.postgresql.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("industry", sa.String(), nullable=True),
        sa.Column("website_url", sa.String(), nullable=True),
        sa.Column("careers_url", sa.String(), nullable=True),
        sa.Column("logo_url", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("size_band", sa.String(), nullable=True),
        sa.Column("headquarters_city", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # job_posting
    op.create_table(
        "job_posting",
        sa.Column("id", sa.dialects.postgresql.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("company_id", sa.dialects.postgresql.UUID(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("team", sa.String(), nullable=True),
        sa.Column("role_type", sa.dialects.postgresql.ENUM(name="role_type", create_type=False), nullable=True),
        sa.Column("work_arrangement", sa.dialects.postgresql.ENUM(name="work_arrangement", create_type=False), nullable=True),
        sa.Column("location_city", sa.String(), nullable=True),
        sa.Column("posting_url", sa.String(), nullable=True),
        sa.Column("description_md", sa.Text(), nullable=True),
        sa.Column("application_deadline", sa.Date(), nullable=True),
        sa.Column("comp_min_cents", sa.BigInteger(), nullable=True),
        sa.Column("comp_max_cents", sa.BigInteger(), nullable=True),
        sa.Column("comp_currency", sa.String(length=3), server_default=sa.text("'USD'"), nullable=True),
        sa.Column("comp_period", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["company_id"], ["company.id"], ondelete="CASCADE"),
    )

    # application
    op.create_table(
        "application",
        sa.Column("id", sa.dialects.postgresql.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("job_posting_id", sa.dialects.postgresql.UUID(), nullable=False),
        sa.Column("current_status", sa.dialects.postgresql.ENUM(name="application_status", create_type=False), server_default="wishlist", nullable=False),
        sa.Column("priority", sa.dialects.postgresql.ENUM(name="priority_tier", create_type=False), server_default="medium", nullable=True),
        sa.Column("source", sa.dialects.postgresql.ENUM(name="application_source", create_type=False), nullable=True),
        sa.Column("applied_on", sa.Date(), nullable=True),
        sa.Column("next_action", sa.Text(), nullable=True),
        sa.Column("next_action_due", sa.Date(), nullable=True),
        sa.Column("personal_notes", sa.Text(), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["job_posting_id"], ["job_posting.id"], ondelete="CASCADE"),
    )

    # interview_round
    op.create_table(
        "interview_round",
        sa.Column("id", sa.dialects.postgresql.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("application_id", sa.dialects.postgresql.UUID(), nullable=False),
        sa.Column("round_number", sa.Integer(), nullable=False),
        sa.Column("round_type", sa.dialects.postgresql.ENUM(name="round_type", create_type=False), nullable=True),
        sa.Column("label", sa.String(), nullable=True),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("location", sa.String(), nullable=True),
        sa.Column("outcome", sa.dialects.postgresql.ENUM(name="round_outcome", create_type=False), server_default="pending", nullable=True),
        sa.Column("self_rating", sa.Integer(), nullable=True),
        sa.Column("debrief_md", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["application_id"], ["application.id"], ondelete="CASCADE"),
    )

    # application_status_event
    op.create_table(
        "application_status_event",
        sa.Column("id", sa.dialects.postgresql.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("application_id", sa.dialects.postgresql.UUID(), nullable=False),
        sa.Column("status", sa.dialects.postgresql.ENUM(name="application_status", create_type=False), nullable=False),
        sa.Column("changed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["application_id"], ["application.id"], ondelete="CASCADE"),
    )

    # offer
    op.create_table(
        "offer",
        sa.Column("id", sa.dialects.postgresql.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("application_id", sa.dialects.postgresql.UUID(), nullable=False),
        sa.Column("received_on", sa.Date(), nullable=True),
        sa.Column("decision_deadline", sa.Date(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("total_first_year_cents", sa.BigInteger(), nullable=True),
        sa.Column("currency", sa.String(length=3), server_default=sa.text("'USD'"), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["application_id"], ["application.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("application_id"),
    )

    # rejection
    op.create_table(
        "rejection",
        sa.Column("id", sa.dialects.postgresql.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("application_id", sa.dialects.postgresql.UUID(), nullable=False),
        sa.Column("rejected_on", sa.Date(), nullable=True),
        sa.Column("stage", sa.String(), nullable=True),
        sa.Column("reason_given", sa.Text(), nullable=True),
        sa.Column("feedback_md", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["application_id"], ["application.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("application_id"),
    )

    # tag
    op.create_table(
        "tag",
        sa.Column("id", sa.dialects.postgresql.UUID(), server_default=sa.text("uuid_generate_v4()"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("color", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    # application_tag
    op.create_table(
        "application_tag",
        sa.Column("application_id", sa.dialects.postgresql.UUID(), nullable=False),
        sa.Column("tag_id", sa.dialects.postgresql.UUID(), nullable=False),
        sa.PrimaryKeyConstraint("application_id", "tag_id"),
        sa.ForeignKeyConstraint(["application_id"], ["application.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tag_id"], ["tag.id"], ondelete="CASCADE"),
    )

    # ── Triggers ─────────────────────────────────────────────────────────────

    # updated_at trigger function (reusable)
    op.execute("""
        CREATE OR REPLACE FUNCTION set_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    for tbl in ("company", "job_posting", "application", "interview_round", "offer"):
        op.execute(f"""
            CREATE TRIGGER trg_{tbl}_updated_at
            BEFORE UPDATE ON {tbl}
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        """)

    # Sync current_status: when a status event is inserted, update the
    # application's current_status to match.
    op.execute("""
        CREATE OR REPLACE FUNCTION sync_current_status()
        RETURNS TRIGGER AS $$
        BEGIN
            UPDATE application
               SET current_status = NEW.status
             WHERE id = NEW.application_id;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_sync_current_status
        AFTER INSERT ON application_status_event
        FOR EACH ROW EXECUTE FUNCTION sync_current_status();
    """)

    # ── Views ────────────────────────────────────────────────────────────────

    op.execute("""
        CREATE OR REPLACE VIEW v_application_overview AS
        SELECT
            a.id              AS application_id,
            c.name            AS company_name,
            c.logo_url,
            jp.title          AS job_title,
            jp.role_type,
            jp.work_arrangement,
            jp.location_city,
            a.current_status,
            a.priority,
            a.source,
            a.applied_on,
            a.next_action,
            a.next_action_due,
            a.archived_at,
            a.created_at,
            a.updated_at
        FROM application a
        JOIN job_posting jp ON jp.id = a.job_posting_id
        JOIN company c      ON c.id  = jp.company_id;
    """)

    op.execute("""
        CREATE OR REPLACE VIEW v_pipeline_counts AS
        SELECT
            current_status,
            count(*)::int AS cnt
        FROM application
        WHERE archived_at IS NULL
        GROUP BY current_status;
    """)


def downgrade() -> None:
    # ── Views ────────────────────────────────────────────────────────────────
    op.execute("DROP VIEW IF EXISTS v_pipeline_counts;")
    op.execute("DROP VIEW IF EXISTS v_application_overview;")

    # ── Triggers ─────────────────────────────────────────────────────────────
    op.execute("DROP TRIGGER IF EXISTS trg_sync_current_status ON application_status_event;")
    op.execute("DROP FUNCTION IF EXISTS sync_current_status();")

    for tbl in ("offer", "interview_round", "application", "job_posting", "company"):
        op.execute(f"DROP TRIGGER IF EXISTS trg_{tbl}_updated_at ON {tbl};")

    op.execute("DROP FUNCTION IF EXISTS set_updated_at();")

    # ── Tables (reverse order of creation) ───────────────────────────────────
    op.drop_table("application_tag")
    op.drop_table("tag")
    op.drop_table("rejection")
    op.drop_table("offer")
    op.drop_table("application_status_event")
    op.drop_table("interview_round")
    op.drop_table("application")
    op.drop_table("job_posting")
    op.drop_table("company")

    # ── Enum types ───────────────────────────────────────────────────────────
    op.execute("DROP TYPE IF EXISTS priority_tier;")
    op.execute("DROP TYPE IF EXISTS round_outcome;")
    op.execute("DROP TYPE IF EXISTS round_type;")
    op.execute("DROP TYPE IF EXISTS application_source;")
    op.execute("DROP TYPE IF EXISTS application_status;")
    op.execute("DROP TYPE IF EXISTS work_arrangement;")
    op.execute("DROP TYPE IF EXISTS role_type;")
