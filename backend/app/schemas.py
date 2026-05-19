from datetime import date, datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ProjectStatus(str, Enum):
    live = "live"
    wip = "wip"
    archived = "archived"


# ── Projects ──────────────────────────────────────────────────────────────────

class ProjectMetric(BaseModel):
    label: str
    value: str


class ProjectBase(BaseModel):
    project_id: str
    title: str
    description: str
    tags: List[str]
    year: str
    color: str
    status: ProjectStatus
    link: Optional[str] = None
    images: List[str] = []
    metrics: List[ProjectMetric] = []
    sort_order: int = 0


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    project_id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = None
    year: Optional[str] = None
    color: Optional[str] = None
    status: Optional[ProjectStatus] = None
    link: Optional[str] = None
    images: Optional[List[str]] = None
    metrics: Optional[List[ProjectMetric]] = None
    sort_order: Optional[int] = None


class ProjectResponse(ProjectBase):
    id: int

    model_config = {"from_attributes": True}


# ── Testimonials ──────────────────────────────────────────────────────────────

class TestimonialBase(BaseModel):
    name: str
    role: str
    quote: str
    avatar_url: Optional[str] = None
    sort_order: int = 0


class TestimonialCreate(TestimonialBase):
    pass


class TestimonialUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    quote: Optional[str] = None
    avatar_url: Optional[str] = None
    sort_order: Optional[int] = None


class TestimonialResponse(TestimonialBase):
    id: int

    model_config = {"from_attributes": True}


# ── Tracked Links ─────────────────────────────────────────────────────────────

class ProjectCtx(BaseModel):
    visibility: str = "show"


class SkillCtx(BaseModel):
    visibility: str = "show"


class ExperienceCtx(BaseModel):
    visibility: str = "show"
    title: Optional[str] = None
    subtitle: Optional[str] = None
    description: Optional[str] = None
    note: Optional[str] = None


class InterestCtx(BaseModel):
    visibility: str = "show"


class TestimonialCtx(BaseModel):
    visibility: str = "show"


class AboutCtx(BaseModel):
    bio_paragraphs: Optional[List[str]] = None
    status_text: Optional[str] = None
    gpa: Optional[str] = None
    looking_for: Optional[List[Any]] = None
    info_fields: Optional[List[Any]] = None
    headshot_url: Optional[str] = None
    facts: Optional[List[Any]] = None


class PortfolioCtx(BaseModel):
    company: Optional[str] = None
    tagline: Optional[str] = None
    projects: Dict[str, ProjectCtx] = {}
    skills: Dict[str, SkillCtx] = {}
    experience: Dict[str, ExperienceCtx] = {}
    interests: Dict[str, InterestCtx] = {}
    testimonials: Dict[str, TestimonialCtx] = {}
    about: Optional[AboutCtx] = None


class TrackedLinkBase(BaseModel):
    slug: str
    destination_url: str
    label: str
    portfolio_ctx: Optional[PortfolioCtx] = None


class TrackedLinkCreate(TrackedLinkBase):
    pass


class TrackedLinkUpdate(BaseModel):
    slug: Optional[str] = None
    destination_url: Optional[str] = None
    label: Optional[str] = None
    portfolio_ctx: Optional[PortfolioCtx] = None


class TrackedLinkResponse(TrackedLinkBase):
    id: int
    clicks: int

    model_config = {"from_attributes": True}


# ── Skills ────────────────────────────────────────────────────────────────────

class SkillBase(BaseModel):
    name: str
    level: int
    category: str
    sort_order: int = 0


class SkillCreate(SkillBase):
    pass


class SkillUpdate(BaseModel):
    name: Optional[str] = None
    level: Optional[int] = None
    category: Optional[str] = None
    sort_order: Optional[int] = None


class SkillResponse(SkillBase):
    id: int

    model_config = {"from_attributes": True}


# ── Experience ────────────────────────────────────────────────────────────────

class ExperienceBase(BaseModel):
    year: str
    title: str
    subtitle: str
    description: str
    active: bool = False
    sort_order: int = 0


class ExperienceCreate(ExperienceBase):
    pass


class ExperienceUpdate(BaseModel):
    year: Optional[str] = None
    title: Optional[str] = None
    subtitle: Optional[str] = None
    description: Optional[str] = None
    active: Optional[bool] = None
    sort_order: Optional[int] = None


class ExperienceResponse(ExperienceBase):
    id: int

    model_config = {"from_attributes": True}


# ── About ─────────────────────────────────────────────────────────────────────

class FactItem(BaseModel):
    icon: str
    text: str


class InfoField(BaseModel):
    label: str
    value: str


class LookingForItem(BaseModel):
    role: str
    location: str = ""
    timeline: str = ""
    detail: str = ""


class AboutBase(BaseModel):
    bio_paragraphs: List[str]
    facts: List[FactItem]
    headshot_url: Optional[str] = None
    status_text: Optional[str] = None
    gpa: Optional[str] = None
    looking_for: List[LookingForItem] = []
    info_fields: List[InfoField]


class AboutUpdate(BaseModel):
    bio_paragraphs: Optional[List[str]] = None
    facts: Optional[List[FactItem]] = None
    headshot_url: Optional[str] = None
    status_text: Optional[str] = None
    gpa: Optional[str] = None
    looking_for: Optional[List[LookingForItem]] = None
    info_fields: Optional[List[InfoField]] = None


class AboutResponse(AboutBase):
    id: int

    model_config = {"from_attributes": True}


# ── Interests ─────────────────────────────────────────────────────────────────

class InterestBase(BaseModel):
    icon: str
    label: str
    desc: str
    sort_order: int = 0


class InterestCreate(InterestBase):
    pass


class InterestUpdate(BaseModel):
    icon: Optional[str] = None
    label: Optional[str] = None
    desc: Optional[str] = None
    sort_order: Optional[int] = None


class InterestResponse(InterestBase):
    id: int

    model_config = {"from_attributes": True}


# ── Coursework ────────────────────────────────────────────────────────────────

class CourseworkBase(BaseModel):
    name: str
    sort_order: int = 0


class CourseworkCreate(CourseworkBase):
    pass


class CourseworkUpdate(BaseModel):
    name: Optional[str] = None
    sort_order: Optional[int] = None


class CourseworkResponse(CourseworkBase):
    id: int

    model_config = {"from_attributes": True}


# ── Socials ───────────────────────────────────────────────────────────────────

class SocialBase(BaseModel):
    icon: str
    label: str
    handle: str
    href: str
    sort_order: int = 0


class SocialCreate(SocialBase):
    pass


class SocialUpdate(BaseModel):
    icon: Optional[str] = None
    label: Optional[str] = None
    handle: Optional[str] = None
    href: Optional[str] = None
    sort_order: Optional[int] = None


class SocialResponse(SocialBase):
    id: int

    model_config = {"from_attributes": True}


# ── Contact Submit ────────────────────────────────────────────────────────────

class ContactSubmit(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=1, max_length=254)
    message: str = Field(min_length=10, max_length=2000)
    honeypot: Optional[str] = None


# ── Contact Meta ──────────────────────────────────────────────────────────────

class ContactMetaBase(BaseModel):
    heading: str
    subheading: str
    body_text: str
    location_text: str


class ContactMetaUpdate(BaseModel):
    heading: Optional[str] = None
    subheading: Optional[str] = None
    body_text: Optional[str] = None
    location_text: Optional[str] = None


class ContactMetaResponse(ContactMetaBase):
    id: int

    model_config = {"from_attributes": True}


# ── Blog ──────────────────────────────────────────────────────────────────────

class BlogPostBase(BaseModel):
    slug: str
    title: str
    subtitle: Optional[str] = None
    content: str
    excerpt: Optional[str] = None
    cover_image_url: Optional[str] = None
    tags: List[str] = []
    published: bool = False


class BlogPostCreate(BlogPostBase):
    pass


class BlogPostUpdate(BaseModel):
    slug: Optional[str] = None
    title: Optional[str] = None
    subtitle: Optional[str] = None
    content: Optional[str] = None
    excerpt: Optional[str] = None
    cover_image_url: Optional[str] = None
    tags: Optional[List[str]] = None
    published: Optional[bool] = None


class BlogPostResponse(BlogPostBase):
    id: int
    published_at: Optional[str] = None
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


# ── Internship Tracker Enums ─────────────────────────────────────────────────

class RoleType(str, Enum):
    internship = "internship"
    coop = "coop"
    new_grad = "new_grad"
    full_time = "full_time"
    contract = "contract"
    part_time = "part_time"


class WorkArrangement(str, Enum):
    onsite = "onsite"
    hybrid = "hybrid"
    remote = "remote"


class ApplicationStatus(str, Enum):
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


class ApplicationSource(str, Enum):
    linkedin = "linkedin"
    indeed = "indeed"
    handshake = "handshake"
    company_site = "company_site"
    referral = "referral"
    career_fair = "career_fair"
    recruiter_outreach = "recruiter_outreach"
    university_portal = "university_portal"
    other = "other"


class RoundType(str, Enum):
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


class RoundOutcome(str, Enum):
    pending = "pending"
    passed = "passed"
    failed = "failed"
    cancelled = "cancelled"
    no_show = "no_show"


class PriorityTier(str, Enum):
    dream = "dream"
    high = "high"
    medium = "medium"
    low = "low"
    backup = "backup"


# ── Company ──────────────────────────────────────────────────────────────────

class CompanyBase(BaseModel):
    name: str
    industry: Optional[str] = None
    website_url: Optional[str] = None
    careers_url: Optional[str] = None
    logo_url: Optional[str] = None
    notes: Optional[str] = None
    size_band: Optional[str] = None
    headquarters_city: Optional[str] = None


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    website_url: Optional[str] = None
    careers_url: Optional[str] = None
    logo_url: Optional[str] = None
    notes: Optional[str] = None
    size_band: Optional[str] = None
    headquarters_city: Optional[str] = None


class CompanyResponse(CompanyBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Job Posting ──────────────────────────────────────────────────────────────

class JobPostingBase(BaseModel):
    company_id: str
    title: str
    team: Optional[str] = None
    role_type: Optional[RoleType] = None
    work_arrangement: Optional[WorkArrangement] = None
    location_city: Optional[str] = None
    posting_url: Optional[str] = None
    description_md: Optional[str] = None
    application_deadline: Optional[date] = None
    comp_min_cents: Optional[int] = None
    comp_max_cents: Optional[int] = None
    comp_currency: Optional[str] = "USD"
    comp_period: Optional[str] = None
    notes: Optional[str] = None


class JobPostingCreate(JobPostingBase):
    pass


class JobPostingUpdate(BaseModel):
    company_id: Optional[str] = None
    title: Optional[str] = None
    team: Optional[str] = None
    role_type: Optional[RoleType] = None
    work_arrangement: Optional[WorkArrangement] = None
    location_city: Optional[str] = None
    posting_url: Optional[str] = None
    description_md: Optional[str] = None
    application_deadline: Optional[date] = None
    comp_min_cents: Optional[int] = None
    comp_max_cents: Optional[int] = None
    comp_currency: Optional[str] = None
    comp_period: Optional[str] = None
    notes: Optional[str] = None


class JobPostingResponse(JobPostingBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Application ──────────────────────────────────────────────────────────────

class ApplicationBase(BaseModel):
    job_posting_id: str
    current_status: ApplicationStatus = ApplicationStatus.wishlist
    priority: Optional[PriorityTier] = PriorityTier.medium
    source: Optional[ApplicationSource] = None
    applied_on: Optional[date] = None
    next_action: Optional[str] = None
    next_action_due: Optional[date] = None
    personal_notes: Optional[str] = None


class ApplicationCreate(BaseModel):
    company_name: str
    company_id: Optional[str] = None
    job_title: str
    team: Optional[str] = None
    role_type: Optional[str] = None
    work_arrangement: Optional[str] = None
    location_city: Optional[str] = None
    posting_url: Optional[str] = None
    current_status: Optional[str] = "wishlist"
    priority: Optional[str] = "medium"
    source: Optional[str] = None
    applied_on: Optional[str] = None
    next_action: Optional[str] = None
    next_action_due: Optional[str] = None
    personal_notes: Optional[str] = None


class ApplicationUpdate(BaseModel):
    job_posting_id: Optional[str] = None
    current_status: Optional[ApplicationStatus] = None
    priority: Optional[PriorityTier] = None
    source: Optional[ApplicationSource] = None
    applied_on: Optional[date] = None
    next_action: Optional[str] = None
    next_action_due: Optional[date] = None
    personal_notes: Optional[str] = None


class ApplicationResponse(ApplicationBase):
    id: str
    archived_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Tag ──────────────────────────────────────────────────────────────────────

class TagBase(BaseModel):
    name: str
    color: Optional[str] = None


class TagCreate(TagBase):
    pass


class TagUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


class TagResponse(TagBase):
    id: str

    model_config = {"from_attributes": True}


# ── Application List Item ────────────────────────────────────────────────────

class ApplicationListItem(BaseModel):
    id: str
    company_name: Optional[str] = None
    company_id: Optional[str] = None
    job_posting_id: Optional[str] = None
    job_title: Optional[str] = None
    team: Optional[str] = None
    role_type: Optional[str] = None
    work_arrangement: Optional[str] = None
    location_city: Optional[str] = None
    posting_url: Optional[str] = None
    current_status: Optional[str] = None
    priority: Optional[str] = None
    source: Optional[str] = None
    applied_on: Optional[str] = None
    next_action: Optional[str] = None
    next_action_due: Optional[str] = None
    personal_notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    tags: List[TagResponse] = []


# ── Interview Round ──────────────────────────────────────────────────────────

class InterviewRoundBase(BaseModel):
    round_number: int
    round_type: Optional[str] = None
    label: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    location: Optional[str] = None
    outcome: Optional[str] = "pending"
    self_rating: Optional[int] = None
    debrief_md: Optional[str] = None


class InterviewRoundCreate(InterviewRoundBase):
    pass


class InterviewRoundUpdate(BaseModel):
    round_number: Optional[int] = None
    round_type: Optional[RoundType] = None
    label: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    location: Optional[str] = None
    outcome: Optional[RoundOutcome] = None
    self_rating: Optional[int] = None
    debrief_md: Optional[str] = None


class InterviewRoundResponse(InterviewRoundBase):
    id: str
    application_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Application Status Event ────────────────────────────────────────────────

class StatusEventBase(BaseModel):
    status: str
    note: Optional[str] = None


class StatusEventCreate(StatusEventBase):
    pass


class StatusEventResponse(StatusEventBase):
    id: str
    changed_at: datetime

    model_config = {"from_attributes": True}


# ── Offer ────────────────────────────────────────────────────────────────────

class OfferBase(BaseModel):
    received_on: Optional[date] = None
    decision_deadline: Optional[date] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None
    total_first_year_cents: Optional[int] = None
    currency: Optional[str] = "USD"
    notes: Optional[str] = None


class OfferCreate(OfferBase):
    pass


class OfferUpdate(BaseModel):
    received_on: Optional[date] = None
    decision_deadline: Optional[date] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None
    total_first_year_cents: Optional[int] = None
    currency: Optional[str] = None
    notes: Optional[str] = None


class OfferResponse(OfferBase):
    id: str
    application_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Rejection ────────────────────────────────────────────────────────────────

class RejectionBase(BaseModel):
    application_id: str
    rejected_on: Optional[date] = None
    stage: Optional[str] = None
    reason_given: Optional[str] = None
    feedback_md: Optional[str] = None


class RejectionCreate(RejectionBase):
    pass


class RejectionUpdate(BaseModel):
    rejected_on: Optional[date] = None
    stage: Optional[str] = None
    reason_given: Optional[str] = None
    feedback_md: Optional[str] = None


class RejectionResponse(RejectionBase):
    id: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Dashboard / Overview ─────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_applications: int
    status_counts: dict
    priority_counts: dict
    source_counts: dict
    upcoming_actions: List[ApplicationListItem]
    recent_applications: List[ApplicationListItem]
    response_rate: float
    offer_rate: float
