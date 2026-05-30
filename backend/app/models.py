import enum
from sqlalchemy import (
    Column, Integer, BigInteger, String, Boolean, JSON, Text, Date,
    DateTime, ForeignKey, Enum as SAEnum, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import relationship
from app.database import Base


class ProjectStatus(str, enum.Enum):
    live = "live"
    wip = "wip"
    archived = "archived"


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    tags = Column(JSON, nullable=False, default=list)
    year = Column(String, nullable=False)
    color = Column(String, nullable=False)
    status = Column(SAEnum(ProjectStatus, name="projectstatus"), nullable=False)
    link = Column(String, nullable=True)
    images = Column(JSON, nullable=False, default=list)
    metrics = Column(JSON, nullable=False, default=list)  # [{label, value}]
    sort_order = Column(Integer, nullable=False, default=0)


class Testimonial(Base):
    __tablename__ = "testimonials"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    quote = Column(Text, nullable=False)
    avatar_url = Column(String, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)


class TrackedLink(Base):
    __tablename__ = "tracked_links"

    id = Column(Integer, primary_key=True, autoincrement=True)
    slug = Column(String, unique=True, index=True, nullable=False)
    destination_url = Column(String, nullable=False)
    label = Column(String, nullable=False)
    clicks = Column(Integer, nullable=False, default=0)
    portfolio_ctx = Column(JSON, nullable=True)


class TestimonialRequest(Base):
    __tablename__ = "testimonial_requests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    slug = Column(String, unique=True, index=True, nullable=False)
    requester_name = Column(String, nullable=False)
    requester_email = Column(String, nullable=True)
    requester_role = Column(String, nullable=True)
    personal_message = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="pending")

    submitted_name = Column(String, nullable=True)
    submitted_role = Column(String, nullable=True)
    submitted_quote = Column(Text, nullable=True)
    submitted_avatar_url = Column(String, nullable=True)

    created_at = Column(String, nullable=False)
    submitted_at = Column(String, nullable=True)
    reviewed_at = Column(String, nullable=True)
    testimonial_id = Column(Integer, ForeignKey("testimonials.id"), nullable=True)


class Skill(Base):
    __tablename__ = "skills"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    level = Column(Integer, nullable=False)
    category = Column(String, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)


class Experience(Base):
    __tablename__ = "experience"

    id = Column(Integer, primary_key=True, autoincrement=True)
    year = Column(String, nullable=False)
    title = Column(String, nullable=False)
    subtitle = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    active = Column(Boolean, nullable=False, default=False)
    sort_order = Column(Integer, nullable=False, default=0)


class About(Base):
    __tablename__ = "about"

    id = Column(Integer, primary_key=True, default=1)
    bio_paragraphs = Column(JSON, nullable=False, default=list)
    facts = Column(JSON, nullable=False, default=list)
    headshot_url = Column(String, nullable=True)
    status_text = Column(String, nullable=True)
    gpa = Column(String, nullable=True)
    looking_for = Column(JSON, nullable=False, default=list)  # [{role, location, timeline, detail}]
    info_fields = Column(JSON, nullable=False, default=list)


class Interest(Base):
    __tablename__ = "interests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    icon = Column(String, nullable=False)
    label = Column(String, nullable=False)
    desc = Column(Text, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)


class Coursework(Base):
    __tablename__ = "coursework"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)


class Social(Base):
    __tablename__ = "socials"

    id = Column(Integer, primary_key=True, autoincrement=True)
    icon = Column(String, nullable=False)
    label = Column(String, nullable=False)
    handle = Column(String, nullable=False)
    href = Column(String, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)


class ContactMeta(Base):
    __tablename__ = "contact_meta"

    id = Column(Integer, primary_key=True, default=1)
    heading = Column(String, nullable=False)
    subheading = Column(String, nullable=False)
    body_text = Column(Text, nullable=False)
    location_text = Column(String, nullable=False)


class BlogPost(Base):
    __tablename__ = "blog_posts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    slug = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=False)
    subtitle = Column(String, nullable=True)
    content = Column(Text, nullable=False)
    excerpt = Column(Text, nullable=True)
    cover_image_url = Column(String, nullable=True)
    tags = Column(JSON, nullable=False, default=list)
    published = Column(Boolean, nullable=False, default=False)
    published_at = Column(String, nullable=True)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)


# ── Internship Tracker Enums ─────────────────────────────────────────────────

class RoleType(str, enum.Enum):
    internship = "internship"
    coop = "coop"
    new_grad = "new_grad"
    full_time = "full_time"
    contract = "contract"
    part_time = "part_time"


class WorkArrangement(str, enum.Enum):
    onsite = "onsite"
    hybrid = "hybrid"
    remote = "remote"


class ApplicationStatus(str, enum.Enum):
    wishlist = "wishlist"
    drafting = "drafting"
    applied = "applied"
    online_assessment = "online_assessment"
    recruiter_screen = "recruiter_screen"
    phone_screen = "phone_screen"
    technical = "technical"
    onsite = "onsite"
    final_round = "final_round"
    offer = "offer"
    accepted = "accepted"
    declined = "declined"
    rejected = "rejected"
    withdrawn = "withdrawn"
    ghosted = "ghosted"


class ApplicationSource(str, enum.Enum):
    linkedin = "linkedin"
    indeed = "indeed"
    handshake = "handshake"
    company_site = "company_site"
    referral = "referral"
    career_fair = "career_fair"
    recruiter_outreach = "recruiter_outreach"
    university_portal = "university_portal"
    other = "other"


class RoundType(str, enum.Enum):
    online_assessment = "online_assessment"
    recruiter_screen = "recruiter_screen"
    phone_screen = "phone_screen"
    technical_phone = "technical_phone"
    coding = "coding"
    system_design = "system_design"
    behavioral = "behavioral"
    take_home = "take_home"
    pair_programming = "pair_programming"
    onsite_loop = "onsite_loop"
    hiring_manager = "hiring_manager"
    team_match = "team_match"
    offer_call = "offer_call"
    other = "other"


class RoundOutcome(str, enum.Enum):
    pending = "pending"
    passed = "passed"
    failed = "failed"
    cancelled = "cancelled"
    no_show = "no_show"


class PriorityTier(str, enum.Enum):
    dream = "dream"
    high = "high"
    medium = "medium"
    low = "low"
    backup = "backup"


# ── Internship Tracker Models ────────────────────────────────────────────────

class Company(Base):
    __tablename__ = "company"

    id = Column(PgUUID(as_uuid=False), primary_key=True, server_default="uuid_generate_v4()")
    name = Column(String, nullable=False)
    industry = Column(String, nullable=True)
    website_url = Column(String, nullable=True)
    careers_url = Column(String, nullable=True)
    logo_url = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    size_band = Column(String, nullable=True)
    headquarters_city = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)

    job_postings = relationship("JobPosting", back_populates="company")


class JobPosting(Base):
    __tablename__ = "job_posting"

    id = Column(PgUUID(as_uuid=False), primary_key=True, server_default="uuid_generate_v4()")
    company_id = Column(PgUUID(as_uuid=False), ForeignKey("company.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    team = Column(String, nullable=True)
    role_type = Column(SAEnum(RoleType, name="role_type", create_constraint=False), nullable=True)
    work_arrangement = Column(SAEnum(WorkArrangement, name="work_arrangement", create_constraint=False), nullable=True)
    location_city = Column(String, nullable=True)
    posting_url = Column(String, nullable=True)
    description_md = Column(Text, nullable=True)
    application_deadline = Column(Date, nullable=True)
    comp_min_cents = Column(BigInteger, nullable=True)
    comp_max_cents = Column(BigInteger, nullable=True)
    comp_currency = Column(String(3), nullable=True, server_default="USD")
    comp_period = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)

    company = relationship("Company", back_populates="job_postings")
    applications = relationship("Application", back_populates="job_posting")


class Application(Base):
    __tablename__ = "application"

    id = Column(PgUUID(as_uuid=False), primary_key=True, server_default="uuid_generate_v4()")
    job_posting_id = Column(PgUUID(as_uuid=False), ForeignKey("job_posting.id", ondelete="CASCADE"), nullable=False)
    current_status = Column(SAEnum(ApplicationStatus, name="application_status", create_constraint=False), nullable=False, server_default="wishlist")
    priority = Column(SAEnum(PriorityTier, name="priority_tier", create_constraint=False), nullable=True, server_default="medium")
    source = Column(SAEnum(ApplicationSource, name="application_source", create_constraint=False), nullable=True)
    applied_on = Column(Date, nullable=True)
    next_action = Column(Text, nullable=True)
    next_action_due = Column(Date, nullable=True)
    personal_notes = Column(Text, nullable=True)
    archived_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)

    job_posting = relationship("JobPosting", back_populates="applications")
    interview_rounds = relationship("InterviewRound", back_populates="application")
    status_events = relationship("ApplicationStatusEvent", back_populates="application")
    offer = relationship("Offer", back_populates="application", uselist=False)
    rejection = relationship("Rejection", back_populates="application", uselist=False)
    tags = relationship("Tag", secondary="application_tag", back_populates="applications")


class InterviewRound(Base):
    __tablename__ = "interview_round"

    id = Column(PgUUID(as_uuid=False), primary_key=True, server_default="uuid_generate_v4()")
    application_id = Column(PgUUID(as_uuid=False), ForeignKey("application.id", ondelete="CASCADE"), nullable=False)
    round_number = Column(Integer, nullable=False)
    round_type = Column(SAEnum(RoundType, name="round_type", create_constraint=False), nullable=True)
    label = Column(String, nullable=True)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    duration_minutes = Column(Integer, nullable=True)
    location = Column(String, nullable=True)
    outcome = Column(SAEnum(RoundOutcome, name="round_outcome", create_constraint=False), nullable=True, server_default="pending")
    self_rating = Column(Integer, nullable=True)
    debrief_md = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)

    application = relationship("Application", back_populates="interview_rounds")


class ApplicationStatusEvent(Base):
    __tablename__ = "application_status_event"

    id = Column(PgUUID(as_uuid=False), primary_key=True, server_default="uuid_generate_v4()")
    application_id = Column(PgUUID(as_uuid=False), ForeignKey("application.id", ondelete="CASCADE"), nullable=False)
    status = Column(SAEnum(ApplicationStatus, name="application_status", create_constraint=False), nullable=False)
    changed_at = Column(DateTime(timezone=True), nullable=False)
    note = Column(Text, nullable=True)

    application = relationship("Application", back_populates="status_events")


class Offer(Base):
    __tablename__ = "offer"
    __table_args__ = (UniqueConstraint("application_id"),)

    id = Column(PgUUID(as_uuid=False), primary_key=True, server_default="uuid_generate_v4()")
    application_id = Column(PgUUID(as_uuid=False), ForeignKey("application.id", ondelete="CASCADE"), nullable=False)
    received_on = Column(Date, nullable=True)
    decision_deadline = Column(Date, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    status = Column(String, nullable=True)
    total_first_year_cents = Column(BigInteger, nullable=True)
    currency = Column(String(3), nullable=True, server_default="USD")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False)

    application = relationship("Application", back_populates="offer")


class Rejection(Base):
    __tablename__ = "rejection"
    __table_args__ = (UniqueConstraint("application_id"),)

    id = Column(PgUUID(as_uuid=False), primary_key=True, server_default="uuid_generate_v4()")
    application_id = Column(PgUUID(as_uuid=False), ForeignKey("application.id", ondelete="CASCADE"), nullable=False)
    rejected_on = Column(Date, nullable=True)
    stage = Column(String, nullable=True)
    reason_given = Column(Text, nullable=True)
    feedback_md = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False)

    application = relationship("Application", back_populates="rejection")


class Tag(Base):
    __tablename__ = "tag"

    id = Column(PgUUID(as_uuid=False), primary_key=True, server_default="uuid_generate_v4()")
    name = Column(String, nullable=False, unique=True)
    color = Column(String, nullable=True)

    applications = relationship("Application", secondary="application_tag", back_populates="tags")


class ApplicationTag(Base):
    __tablename__ = "application_tag"

    application_id = Column(PgUUID(as_uuid=False), ForeignKey("application.id", ondelete="CASCADE"), primary_key=True)
    tag_id = Column(PgUUID(as_uuid=False), ForeignKey("tag.id", ondelete="CASCADE"), primary_key=True)


class ClaudeUsageDay(Base):
    __tablename__ = "claude_usage_days"

    date = Column(String, primary_key=True)   # YYYY-MM-DD
    tokens = Column(BigInteger, nullable=False, default=0)
    cost_cents = Column(Integer, nullable=False, default=0)
    sessions = Column(Integer, nullable=False, default=0)
    snapshotted_at = Column(String, nullable=False)
