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


# ── Testimonial Requests ───────────────────────────────────────────────────────

class TestimonialRequestCreate(BaseModel):
    slug: str
    requester_name: str
    requester_email: Optional[str] = None
    requester_role: Optional[str] = None
    personal_message: Optional[str] = None


class TestimonialSubmit(BaseModel):
    name: str
    role: str
    quote: str = Field(min_length=10, max_length=2000)
    avatar_url: Optional[str] = None


class TestimonialRequestPublic(BaseModel):
    slug: str
    requester_name: str
    requester_role: Optional[str] = None
    personal_message: Optional[str] = None
    status: str

    model_config = {"from_attributes": True}


class TestimonialRequestResponse(BaseModel):
    id: int
    slug: str
    requester_name: str
    requester_email: Optional[str] = None
    requester_role: Optional[str] = None
    personal_message: Optional[str] = None
    status: str
    submitted_name: Optional[str] = None
    submitted_role: Optional[str] = None
    submitted_quote: Optional[str] = None
    submitted_avatar_url: Optional[str] = None
    created_at: str
    submitted_at: Optional[str] = None
    reviewed_at: Optional[str] = None
    testimonial_id: Optional[int] = None

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
    view_count: int = 0

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

# ── Bookings ─────────────────────────────────────────────────────────────────

class AvailabilityWindowCreate(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    start_time: str
    end_time: str
    allowed_durations: List[int] = [30]
    enabled: bool = True


class AvailabilityWindowUpdate(BaseModel):
    day_of_week: Optional[int] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    allowed_durations: Optional[List[int]] = None
    enabled: Optional[bool] = None


class AvailabilityWindowResponse(BaseModel):
    id: int
    day_of_week: int
    start_time: str
    end_time: str
    allowed_durations: List[int]
    enabled: bool

    model_config = {"from_attributes": True}


class DateOverrideCreate(BaseModel):
    date: date
    reason: Optional[str] = None


class DateOverrideResponse(BaseModel):
    id: int
    date: date
    reason: Optional[str] = None

    model_config = {"from_attributes": True}


class BookingCreate(BaseModel):
    visitor_name: str = Field(min_length=1, max_length=100)
    visitor_email: str = Field(min_length=1, max_length=254)
    topic: str = Field(min_length=5, max_length=500)
    start_at: str
    duration_minutes: int = Field(ge=15, le=30)
    honeypot: Optional[str] = None


class AdminBookingCreate(BaseModel):
    visitor_name: str = Field(min_length=1, max_length=100)
    visitor_email: str = Field(min_length=1, max_length=254)
    topic: str = Field(min_length=1, max_length=500)
    start_at: str
    duration_minutes: int = Field(ge=5, le=120)


class BookingDecision(BaseModel):
    admin_note: Optional[str] = None


class BookingResponse(BaseModel):
    id: int
    visitor_name: str
    visitor_email: str
    topic: str
    start_at: datetime
    duration_minutes: int
    status: str
    zoom_join_url: Optional[str] = None
    zoom_meeting_id: Optional[str] = None
    admin_note: Optional[str] = None
    created_at: datetime
    decided_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AvailableSlot(BaseModel):
    start: str
    end: str
    durations: List[int]


class BookingSettingsUpdate(BaseModel):
    timezone: Optional[str] = None
    enabled: Optional[bool] = None


class BookingSettingsResponse(BaseModel):
    timezone: str
    enabled: bool
    available_days: List[int] = []

    model_config = {"from_attributes": True}


# ── Bio Link in Bio ──────────────────────────────────────────────────────────

class BioLinkBase(BaseModel):
    title: str
    url: str
    description: Optional[str] = None
    icon: Optional[str] = None
    category: Optional[str] = None
    featured: bool = False
    enabled: bool = True
    sort_order: int = 0


class BioLinkCreate(BioLinkBase):
    pass


class BioLinkUpdate(BaseModel):
    title: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    category: Optional[str] = None
    featured: Optional[bool] = None
    enabled: Optional[bool] = None
    sort_order: Optional[int] = None


class BioLinkResponse(BioLinkBase):
    id: int
    clicks: int
    model_config = {"from_attributes": True}


class BioPageSettingsUpdate(BaseModel):
    heading: Optional[str] = None
    subheading: Optional[str] = None
    avatar_url: Optional[str] = None
    show_portfolio_link: Optional[bool] = None
    show_booking_link: Optional[bool] = None


class BioPageSettingsResponse(BaseModel):
    heading: str
    subheading: Optional[str] = None
    avatar_url: Optional[str] = None
    show_portfolio_link: bool
    show_booking_link: bool
    model_config = {"from_attributes": True}


class BioPagePublicResponse(BaseModel):
    settings: BioPageSettingsResponse
    links: List[BioLinkResponse]
    socials: List[SocialResponse] = []


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


# ══════════════════════════════════════════════════════════════════════════════
# Consulting CRM
# ══════════════════════════════════════════════════════════════════════════════

class ContactSource(str, Enum):
    contact_form = "contact_form"
    booking = "booking"
    testimonial = "testimonial"
    manual = "manual"
    referral = "referral"
    other = "other"


class DealStage(str, Enum):
    lead = "lead"
    qualified = "qualified"
    proposal = "proposal"
    negotiation = "negotiation"
    won = "won"
    lost = "lost"


class EngagementStatus(str, Enum):
    active = "active"
    paused = "paused"
    completed = "completed"
    cancelled = "cancelled"


class BillingType(str, Enum):
    hourly = "hourly"
    fixed = "fixed"
    retainer = "retainer"


class ContractStatus(str, Enum):
    draft = "draft"
    sent = "sent"
    accepted = "accepted"
    declined = "declined"
    void = "void"


class InvoiceStatus(str, Enum):
    draft = "draft"
    sent = "sent"
    paid = "paid"
    partial = "partial"
    overdue = "overdue"
    void = "void"


class PaymentMethod(str, Enum):
    venmo = "venmo"
    zelle = "zelle"
    cash = "cash"
    check = "check"
    stripe = "stripe"
    other = "other"


class ActivityType(str, Enum):
    note = "note"
    email = "email"
    call = "call"
    meeting = "meeting"
    contact_form = "contact_form"
    booking = "booking"
    status_change = "status_change"


# ── Organizations ─────────────────────────────────────────────────────────────

class OrganizationBase(BaseModel):
    name: str
    website_url: Optional[str] = None
    industry: Optional[str] = None
    logo_url: Optional[str] = None
    notes: Optional[str] = None


class OrganizationCreate(OrganizationBase):
    pass


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    website_url: Optional[str] = None
    industry: Optional[str] = None
    logo_url: Optional[str] = None
    notes: Optional[str] = None


class OrganizationResponse(OrganizationBase):
    id: str
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# ── Contacts ──────────────────────────────────────────────────────────────────

class ContactBase(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    title: Optional[str] = None
    company_name: Optional[str] = None
    organization_id: Optional[str] = None
    source: Optional[ContactSource] = None
    tags: List[str] = []
    notes: Optional[str] = None


class ContactCreate(ContactBase):
    pass


class ContactUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    title: Optional[str] = None
    company_name: Optional[str] = None
    organization_id: Optional[str] = None
    source: Optional[ContactSource] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None


class ContactResponse(ContactBase):
    id: str
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class ActivityCreate(BaseModel):
    type: ActivityType = ActivityType.note
    body_md: Optional[str] = None
    engagement_id: Optional[str] = None
    occurred_at: Optional[datetime] = None


class ActivityResponse(BaseModel):
    id: str
    contact_id: str
    engagement_id: Optional[str] = None
    type: ActivityType
    body_md: Optional[str] = None
    occurred_at: datetime
    created_at: datetime
    model_config = {"from_attributes": True}


class ContactBookingRef(BaseModel):
    id: int
    topic: str
    start_at: datetime
    status: str
    model_config = {"from_attributes": True}


class ContactDetail(ContactResponse):
    organization: Optional[OrganizationResponse] = None
    activities: List[ActivityResponse] = []
    deals: List["DealResponse"] = []
    engagements: List["EngagementResponse"] = []
    bookings: List[ContactBookingRef] = []


# ── Deals (pipeline) ──────────────────────────────────────────────────────────

class DealBase(BaseModel):
    contact_id: str
    organization_id: Optional[str] = None
    title: str
    stage: DealStage = DealStage.lead
    value_cents: Optional[int] = None
    currency: str = "USD"
    expected_close_date: Optional[date] = None
    source: Optional[str] = None
    notes: Optional[str] = None


class DealCreate(DealBase):
    pass


class DealUpdate(BaseModel):
    organization_id: Optional[str] = None
    title: Optional[str] = None
    stage: Optional[DealStage] = None
    value_cents: Optional[int] = None
    currency: Optional[str] = None
    expected_close_date: Optional[date] = None
    source: Optional[str] = None
    notes: Optional[str] = None
    lost_reason: Optional[str] = None


class DealStageUpdate(BaseModel):
    stage: DealStage
    lost_reason: Optional[str] = None


class DealResponse(BaseModel):
    id: str
    contact_id: str
    organization_id: Optional[str] = None
    title: str
    stage: DealStage
    value_cents: Optional[int] = None
    currency: str
    expected_close_date: Optional[date] = None
    source: Optional[str] = None
    notes: Optional[str] = None
    won_at: Optional[datetime] = None
    lost_reason: Optional[str] = None
    contact_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# ── Engagements ───────────────────────────────────────────────────────────────

class EngagementBase(BaseModel):
    contact_id: str
    organization_id: Optional[str] = None
    deal_id: Optional[str] = None
    title: str
    status: EngagementStatus = EngagementStatus.active
    billing_type: BillingType = BillingType.hourly
    rate_cents: Optional[int] = None
    fixed_amount_cents: Optional[int] = None
    retainer_amount_cents: Optional[int] = None
    retainer_period: Optional[str] = "monthly"
    currency: str = "USD"
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    description: Optional[str] = None


class EngagementCreate(EngagementBase):
    pass


class EngagementUpdate(BaseModel):
    organization_id: Optional[str] = None
    title: Optional[str] = None
    status: Optional[EngagementStatus] = None
    billing_type: Optional[BillingType] = None
    rate_cents: Optional[int] = None
    fixed_amount_cents: Optional[int] = None
    retainer_amount_cents: Optional[int] = None
    retainer_period: Optional[str] = None
    currency: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    description: Optional[str] = None


class EngagementResponse(BaseModel):
    id: str
    contact_id: str
    organization_id: Optional[str] = None
    deal_id: Optional[str] = None
    title: str
    status: EngagementStatus
    billing_type: BillingType
    rate_cents: Optional[int] = None
    fixed_amount_cents: Optional[int] = None
    retainer_amount_cents: Optional[int] = None
    retainer_period: Optional[str] = None
    currency: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    description: Optional[str] = None
    contact_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# ── Contracts ─────────────────────────────────────────────────────────────────

class ContractBase(BaseModel):
    engagement_id: str
    title: str
    scope_md: Optional[str] = None
    terms_md: Optional[str] = None
    total_value_cents: Optional[int] = None
    currency: str = "USD"
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    file_url: Optional[str] = None


class ContractCreate(ContractBase):
    pass


class ContractUpdate(BaseModel):
    title: Optional[str] = None
    scope_md: Optional[str] = None
    terms_md: Optional[str] = None
    total_value_cents: Optional[int] = None
    currency: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    file_url: Optional[str] = None
    status: Optional[ContractStatus] = None


class ContractResponse(BaseModel):
    id: str
    engagement_id: str
    title: str
    scope_md: Optional[str] = None
    terms_md: Optional[str] = None
    total_value_cents: Optional[int] = None
    currency: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: ContractStatus
    file_url: Optional[str] = None
    public_token: Optional[str] = None
    sent_at: Optional[datetime] = None
    consultant_signed_name: Optional[str] = None
    consultant_signed_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    accepted_name: Optional[str] = None
    signer_email: Optional[str] = None
    email_verified_at: Optional[datetime] = None
    document_sha256: Optional[str] = None
    declined_at: Optional[datetime] = None
    declined_reason: Optional[str] = None
    reminder_sent_at: Optional[datetime] = None
    recipient_email: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class ContractPublic(BaseModel):
    """Client-facing view via magic link."""
    title: str
    scope_md: Optional[str] = None
    terms_md: Optional[str] = None
    total_value_cents: Optional[int] = None
    currency: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: ContractStatus
    accepted_at: Optional[datetime] = None
    accepted_name: Optional[str] = None
    consultant_name: str = "Nathan Blatter"
    consultant_email: str = "nzb22@byu.edu"
    consultant_signed_name: Optional[str] = None
    consultant_signed_at: Optional[datetime] = None
    client_name: Optional[str] = None
    expected_signer_name: Optional[str] = None   # name on file the client must sign with
    signer_email: Optional[str] = None
    email_verified_at: Optional[datetime] = None
    document_sha256: Optional[str] = None
    requires_email_verification: bool = True
    model_config = {"from_attributes": True}


class ContractAccept(BaseModel):
    accepted_name: str
    email: str


class ContractVerifyStart(BaseModel):
    email: str


class ContractVerifyConfirm(BaseModel):
    email: str
    code: str


class ContractEventPublic(BaseModel):
    type: str
    actor_name: Optional[str] = None
    actor_email: Optional[str] = None
    ip: Optional[str] = None
    occurred_at: datetime
    model_config = {"from_attributes": True}


class ContractCertificate(BaseModel):
    title: str
    document_sha256: Optional[str] = None
    consultant_name: str = "Nathan Blatter"
    consultant_signed_at: Optional[datetime] = None
    client_name: Optional[str] = None
    client_signed_at: Optional[datetime] = None
    signer_email: Optional[str] = None
    status: ContractStatus
    events: List[ContractEventPublic] = []


class ContractDecline(BaseModel):
    reason: Optional[str] = None


# ── Time entries ──────────────────────────────────────────────────────────────

class TimeEntryBase(BaseModel):
    engagement_id: str
    entry_date: date
    minutes: int
    description: Optional[str] = None
    billable: bool = True
    rate_cents_override: Optional[int] = None


class TimeEntryCreate(TimeEntryBase):
    pass


class TimeEntryUpdate(BaseModel):
    entry_date: Optional[date] = None
    minutes: Optional[int] = None
    description: Optional[str] = None
    billable: Optional[bool] = None
    rate_cents_override: Optional[int] = None


class TimeEntryResponse(BaseModel):
    id: str
    engagement_id: str
    entry_date: date
    minutes: int
    description: Optional[str] = None
    billable: bool
    rate_cents_override: Optional[int] = None
    invoice_id: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Invoices ──────────────────────────────────────────────────────────────────

class InvoiceLineItemBase(BaseModel):
    description: str
    quantity: float = 1
    unit_price_cents: int = 0
    amount_cents: int = 0
    sort_order: int = 0


class InvoiceLineItemResponse(InvoiceLineItemBase):
    id: str
    model_config = {"from_attributes": True}


class PaymentResponse(BaseModel):
    id: str
    amount_cents: int
    method: Optional[PaymentMethod] = None
    reference: Optional[str] = None
    paid_at: datetime
    note: Optional[str] = None
    model_config = {"from_attributes": True}


class InvoiceCreate(BaseModel):
    engagement_id: str
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    currency: str = "USD"
    tax_cents: int = 0
    notes: Optional[str] = None
    line_items: List[InvoiceLineItemBase] = []


class InvoiceUpdate(BaseModel):
    status: Optional[InvoiceStatus] = None
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    tax_cents: Optional[int] = None
    notes: Optional[str] = None
    line_items: Optional[List[InvoiceLineItemBase]] = None


class InvoiceGenerate(BaseModel):
    """Auto-build an invoice from an engagement's billing model."""
    engagement_id: str
    mode: BillingType                          # hourly | fixed | retainer
    due_date: Optional[date] = None
    tax_cents: int = 0
    period_start: Optional[date] = None        # for retainer
    period_end: Optional[date] = None


class PaymentCreate(BaseModel):
    amount_cents: int
    method: Optional[PaymentMethod] = PaymentMethod.venmo
    reference: Optional[str] = None
    paid_at: Optional[datetime] = None
    note: Optional[str] = None


class InvoiceResponse(BaseModel):
    id: str
    engagement_id: str
    contact_id: Optional[str] = None
    organization_id: Optional[str] = None
    number: str
    status: InvoiceStatus
    issue_date: date
    due_date: Optional[date] = None
    currency: str
    subtotal_cents: int
    tax_cents: int
    total_cents: int
    amount_paid_cents: int
    is_retainer: bool
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    notes: Optional[str] = None
    public_token: Optional[str] = None
    sent_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    reminder_sent_at: Optional[datetime] = None
    recipient_email: Optional[str] = None
    contact_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    line_items: List[InvoiceLineItemResponse] = []
    payments: List[PaymentResponse] = []
    model_config = {"from_attributes": True}


class InvoicePublic(BaseModel):
    """Client-facing invoice via magic link."""
    number: str
    status: InvoiceStatus
    issue_date: date
    due_date: Optional[date] = None
    currency: str
    subtotal_cents: int
    tax_cents: int
    total_cents: int
    amount_paid_cents: int
    notes: Optional[str] = None
    line_items: List[InvoiceLineItemResponse] = []
    bill_to_name: Optional[str] = None
    bill_to_company: Optional[str] = None
    consultant_name: str = "Nathan Blatter"
    consultant_email: str = "nzb22@byu.edu"


# ── Engagement detail (children embedded) ─────────────────────────────────────

class EngagementDetail(EngagementResponse):
    contracts: List[ContractResponse] = []
    time_entries: List[TimeEntryResponse] = []
    invoices: List[InvoiceResponse] = []


# ── CRM dashboard ─────────────────────────────────────────────────────────────

class CrmDashboard(BaseModel):
    pipeline_counts: dict                 # stage -> count
    pipeline_value_cents: int             # open deals (excl. won/lost)
    outstanding_ar_cents: int             # unpaid invoice balances
    paid_this_month_cents: int
    mrr_cents: int                        # sum of active retainer amounts
    unbilled_minutes: int
    contacts_count: int
    active_engagements: int
    overdue_invoices: List[InvoiceResponse] = []


# ── Templates (reusable contract scope/terms & invoice line items) ───────────

class TemplateKind(str, Enum):
    contract = "contract"
    invoice = "invoice"


class TemplateBase(BaseModel):
    kind: TemplateKind
    name: str
    title: Optional[str] = None
    scope_md: Optional[str] = None
    terms_md: Optional[str] = None
    total_value_cents: Optional[int] = None
    line_items: Optional[List[InvoiceLineItemBase]] = None
    notes: Optional[str] = None
    currency: str = "USD"


class TemplateCreate(TemplateBase):
    pass


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    scope_md: Optional[str] = None
    terms_md: Optional[str] = None
    total_value_cents: Optional[int] = None
    line_items: Optional[List[InvoiceLineItemBase]] = None
    notes: Optional[str] = None
    currency: Optional[str] = None


class TemplateResponse(TemplateBase):
    id: str
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


ContactDetail.model_rebuild()
