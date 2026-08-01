const API_BASE = '/api/v1'

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const opts: RequestInit = { method, credentials: 'include' }
  if (body !== undefined) {
    opts.headers = { 'Content-Type': 'application/json' }
    opts.body = JSON.stringify(body)
  }
  const res = await fetch(`${API_BASE}${path}`, opts)
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`)
  if (res.status === 204) return undefined as T
  return res.json()
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface ProjectMetric {
  label: string
  value: string
}

export interface ProjectResponse {
  id: number
  project_id: string
  title: string
  description: string
  tags: string[]
  year: string
  color: string
  status: 'live' | 'wip' | 'archived'
  link?: string
  images: string[]
  metrics: ProjectMetric[]
  sort_order: number
}

export interface SkillResponse {
  id: number
  name: string
  level: number
  category: string
  sort_order: number
}

export interface ExperienceResponse {
  id: number
  year: string
  title: string
  subtitle: string
  description: string
  active: boolean
  sort_order: number
}

export interface LookingForItem {
  role: string
  location: string
  timeline: string
  detail: string
}

export interface AboutResponse {
  id: number
  bio_paragraphs: string[]
  facts: { icon: string; text: string }[]
  headshot_url?: string
  status_text?: string
  gpa?: string
  looking_for: LookingForItem[]
  info_fields: { label: string; value: string }[]
}

export interface TestimonialResponse {
  id: number
  name: string
  role: string
  quote: string
  avatar_url?: string
  sort_order: number
}

export interface InterestResponse {
  id: number
  icon: string
  label: string
  desc: string
  sort_order: number
}

export interface CourseworkResponse {
  id: number
  name: string
  sort_order: number
}

export interface CertificationResponse {
  id: number
  name: string
  issuer: string
  image_url?: string
  image_key?: string
  verify_url?: string
  category?: string
  featured?: boolean
  sort_order: number
  tracked_link_id?: number
  verify_slug?: string
}

export interface SocialResponse {
  id: number
  icon: string
  label: string
  handle: string
  href: string
  sort_order: number
}

export interface ContactMetaResponse {
  id: number
  heading: string
  subheading: string
  body_text: string
  location_text: string
}

export interface BlogPostResponse {
  id: number
  slug: string
  title: string
  subtitle?: string
  content: string
  excerpt?: string
  cover_image_url?: string
  tags: string[]
  published: boolean
  published_at?: string
  created_at: string
  updated_at: string
  view_count?: number
}

export interface ContactSubmitRequest {
  name: string
  email: string
  message: string
  honeypot?: string
}

// ── Editable Site Content (/now, /uses) ──────────────────────────────────────

export interface NowSection { icon: string; title: string; items: string[] }
export interface NowContent { last_updated: string; sections: NowSection[] }

export interface UsesItem { name: string; note: string }
export interface UsesCategory { icon: string; title: string; items: UsesItem[] }
export interface UsesContent { categories: UsesCategory[] }

export interface SiteContentResponse<T = unknown> {
  key: string
  data: T
  updated_at?: string
}

export type ServiceStatus = 'operational' | 'degraded' | 'down'
export interface ServiceHealth {
  name: string
  status: ServiceStatus
  latency_ms: number
}
export interface ServiceHealthResponse {
  overall: ServiceStatus
  services: ServiceHealth[]
}

// ── Internship Tracker Types ──────────────────────────────────────────────

export interface CompanyResponse {
  id: string
  name: string
  industry?: string
  website_url?: string
  careers_url?: string
  logo_url?: string
  notes?: string
  size_band?: string
  headquarters_city?: string
  created_at: string
  updated_at: string
}

export interface ApplicationListItem {
  id: string
  company_name: string
  company_id: string
  job_posting_id: string
  job_title: string
  team?: string
  role_type: string
  work_arrangement?: string
  location_city?: string
  posting_url?: string
  current_status: string
  priority: string
  source?: string
  applied_on?: string
  next_action?: string
  next_action_due?: string
  personal_notes?: string
  created_at: string
  updated_at: string
  tags: TagResponse[]
}

export interface InterviewRoundResponse {
  id: string
  application_id: string
  round_number: number
  round_type: string
  label?: string
  scheduled_at?: string
  duration_minutes?: number
  location?: string
  outcome: string
  self_rating?: number
  debrief_md?: string
  created_at: string
  updated_at: string
}

export interface OfferResponse {
  id: string
  application_id: string
  received_on: string
  decision_deadline?: string
  start_date?: string
  end_date?: string
  status: string
  total_first_year_cents?: number
  currency: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface TagResponse {
  id: string
  name: string
  color?: string
}

export interface DashboardStats {
  total_applications: number
  status_counts: Record<string, number>
  priority_counts: Record<string, number>
  source_counts: Record<string, number>
  upcoming_actions: ApplicationListItem[]
  recent_applications: ApplicationListItem[]
  response_rate: number
  offer_rate: number
}

// ── Storage Types ─────────────────────────────────────────────────────────

export interface StorageFile {
  key: string
  size: number
  last_modified: string
}

export interface UploadResponse {
  key: string
  bucket: string
  size: number
}

// ── Tracked Links Types ───────────────────────────────────────────────────

export type CtxVisibility = 'show' | 'highlight' | 'hide'

export interface AboutCtx {
  bio_paragraphs?: string[]
  status_text?: string
  gpa?: string
  looking_for?: { role: string; location: string; timeline: string; detail: string }[]
  info_fields?: { label: string; value: string }[]
  headshot_url?: string
  facts?: { icon: string; text: string }[]
}

export interface PortfolioCtx {
  company?: string
  tagline?: string
  projects: Record<string, { visibility: CtxVisibility }>
  skills: Record<string, { visibility: CtxVisibility }>
  experience: Record<string, { visibility: CtxVisibility; title?: string; subtitle?: string; description?: string; note?: string }>
  interests: Record<string, { visibility: CtxVisibility }>
  testimonials: Record<string, { visibility: CtxVisibility }>
  about?: AboutCtx | null
}

export interface TrackedLinkResponse {
  id: number
  slug: string
  destination_url: string
  label: string
  clicks: number
  portfolio_ctx?: PortfolioCtx | null
}

// ── Testimonial Request Types ─────────────────────────────────────────────

export interface TestimonialRequestResponse {
  id: number
  slug: string
  requester_name: string
  requester_email?: string
  requester_role?: string
  personal_message?: string
  status: 'pending' | 'sent' | 'submitted' | 'approved' | 'rejected'
  submitted_name?: string
  submitted_role?: string
  submitted_quote?: string
  submitted_avatar_url?: string
  created_at: string
  submitted_at?: string
  reviewed_at?: string
  testimonial_id?: number
}

// ── Claude Usage Types ────────────────────────────────────────────────────

export interface ClaudeDay { date: string; tokens: number; cost_cents: number; sessions: number }
export interface ClaudeModel { name: string; tokens: number; cost_cents: number }
export interface ClaudeProject { name: string; tokens: number; cost_cents: number }
export interface ClaudeUsage {
  days: ClaudeDay[]
  models: ClaudeModel[]
  projects: ClaudeProject[]
  summary: { total_tokens: number; total_cost_cents: number; total_sessions: number; active_days: number; streak: number }
}

// ── Home Types ────────────────────────────────────────────────────────────────

export interface HomeResponse {
  projects: ProjectResponse[]
  skills: SkillResponse[]
  experience: ExperienceResponse[]
  about: AboutResponse
}

// ── Resume Page Types ─────────────────────────────────────────────────────────

export interface SearchResult {
  type: 'blog' | 'project' | 'page'
  title: string
  subtitle: string
  url: string
  tags: string[]
}

export interface ResumeVariantResponse {
  id: number
  key: string
  label: string
  headline: string
  summary: string
  emphasis_tags: string[]
  sort_order: number
  is_default: boolean
}

export interface ResumeDataResponse {
  about: AboutResponse
  experience: ExperienceResponse[]
  skills: SkillResponse[]
  projects: ProjectResponse[]
  coursework: CourseworkResponse[]
  variants: ResumeVariantResponse[]
}

// ── About Page Types ──────────────────────────────────────────────────────────

export interface AboutPageResponse {
  about: AboutResponse
  interests: InterestResponse[]
  coursework: CourseworkResponse[]
  experience: ExperienceResponse[]
  testimonials: TestimonialResponse[]
  certifications: CertificationResponse[]
}

// ── Contact Page Types ───────────────────────────────────────────────────────

export interface ContactPageResponse {
  meta: ContactMetaResponse
  socials: SocialResponse[]
}

// ── Solar Types ───────────────────────────────────────────────────────────

export interface SolarResponse {
  mode: 'light' | 'dark'
  sunrise: string  // "HH:MM" local time
  sunset: string
}

// ── Dev Status Types ──────────────────────────────────────────────────────

export interface DevStatusResponse {
  dev_active: boolean
  dev_type: 'ssh' | 'vnc' | 'both' | 'laptop' | 'none'
  stale: boolean
}

// ── GitHub Types ──────────────────────────────────────────────────────────

export interface GitHubProfile {
  username: string
  name: string | null
  avatar_url: string
  html_url: string
  public_repos: number
  followers: number
  bio: string | null
}

export interface GitHubRepo {
  name: string
  description: string | null
  language: string | null
  stars: number
  forks: number
  html_url: string
  homepage: string | null
  updated_at: string
  fork: boolean
  owner?: string
}

export interface GitHubContributions {
  total: number
  streak: number
  days: { date: string; level: number }[]
  activity: Record<string, { name: string; url: string }[]>
  stats?: { commits: number; prs: number; issues: number; reviews: number; private: number }
  owners?: { owner: string; commits: number; prs: number }[]
  source?: string
}

// ── Booking Types ─────────────────────────────────────────────────────────

export interface AvailabilityWindowResponse {
  id: number
  day_of_week: number
  start_time: string
  end_time: string
  allowed_durations: number[]
  enabled: boolean
}

export interface DateOverrideResponse {
  id: number
  date: string
  reason?: string
}

export interface AvailableSlot {
  start: string
  end: string
  durations: number[]
}

export interface BookingResponse {
  id: number
  visitor_name: string
  visitor_email: string
  topic: string
  start_at: string
  duration_minutes: number
  status: string
  zoom_join_url?: string
  zoom_meeting_id?: string
  admin_note?: string
  created_at: string
  decided_at?: string
}

export interface BookingSettingsResponse {
  timezone: string
  enabled: boolean
  available_days: number[]
}

// ── Bio Link in Bio Types ─────────────────────────────────────────────
export interface BioLinkResponse {
  id: number
  title: string
  url: string
  description?: string
  icon?: string
  category?: string
  featured: boolean
  enabled: boolean
  sort_order: number
  clicks: number
}

export interface BioPageSettingsResponse {
  heading: string
  subheading?: string
  avatar_url?: string
  show_portfolio_link: boolean
  show_booking_link: boolean
}

export interface BioPagePublicResponse {
  settings: BioPageSettingsResponse
  links: BioLinkResponse[]
  socials: SocialResponse[]
}

// ── CRM ──────────────────────────────────────────────────────────────────────

export type ContactSource = 'contact_form' | 'booking' | 'testimonial' | 'manual' | 'referral' | 'other'
export type DealStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost'
export type EngagementStatus = 'active' | 'paused' | 'completed' | 'cancelled'
export type BillingType = 'hourly' | 'fixed' | 'retainer'
export type ContractStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'void'
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'void'
export type PaymentMethod = 'venmo' | 'zelle' | 'cash' | 'check' | 'stripe' | 'other'
export type ActivityType = 'note' | 'email' | 'call' | 'meeting' | 'contact_form' | 'booking' | 'status_change'

export const DEAL_STAGES: DealStage[] = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost']

export interface OrganizationResponse {
  id: string
  name: string
  website_url?: string | null
  industry?: string | null
  logo_url?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface ContactResponse {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  title?: string | null
  company_name?: string | null
  organization_id?: string | null
  source?: ContactSource | null
  tags: string[]
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface ActivityResponse {
  id: string
  contact_id: string
  engagement_id?: string | null
  type: ActivityType
  body_md?: string | null
  occurred_at: string
  created_at: string
}

export interface ContactBookingRef {
  id: number
  topic: string
  start_at: string
  status: string
}

export interface ContactDetail extends ContactResponse {
  organization?: OrganizationResponse | null
  activities: ActivityResponse[]
  deals: DealResponse[]
  engagements: EngagementResponse[]
  bookings: ContactBookingRef[]
}

export interface DealResponse {
  id: string
  contact_id: string
  organization_id?: string | null
  title: string
  stage: DealStage
  value_cents?: number | null
  currency: string
  expected_close_date?: string | null
  source?: string | null
  notes?: string | null
  won_at?: string | null
  lost_reason?: string | null
  contact_name?: string | null
  created_at: string
  updated_at: string
}

export interface EngagementResponse {
  id: string
  contact_id: string
  organization_id?: string | null
  deal_id?: string | null
  title: string
  status: EngagementStatus
  billing_type: BillingType
  rate_cents?: number | null
  fixed_amount_cents?: number | null
  retainer_amount_cents?: number | null
  retainer_period?: string | null
  currency: string
  start_date?: string | null
  end_date?: string | null
  description?: string | null
  contact_name?: string | null
  created_at: string
  updated_at: string
}

export interface ContractResponse {
  id: string
  engagement_id: string
  title: string
  scope_md?: string | null
  terms_md?: string | null
  total_value_cents?: number | null
  currency: string
  start_date?: string | null
  end_date?: string | null
  status: ContractStatus
  file_url?: string | null
  public_token?: string | null
  sent_at?: string | null
  accepted_at?: string | null
  accepted_name?: string | null
  declined_at?: string | null
  declined_reason?: string | null
  reminder_sent_at?: string | null
  recipient_email?: string | null
  created_at: string
  updated_at: string
}

export interface ContractPublic {
  title: string
  scope_md?: string | null
  terms_md?: string | null
  total_value_cents?: number | null
  currency: string
  start_date?: string | null
  end_date?: string | null
  status: ContractStatus
  accepted_at?: string | null
  accepted_name?: string | null
  consultant_name: string
  consultant_email?: string
  consultant_signed_name?: string | null
  consultant_signed_at?: string | null
  client_name?: string | null
  expected_signer_name?: string | null
  signer_email?: string | null
  email_verified_at?: string | null
  document_sha256?: string | null
  requires_email_verification?: boolean
  declined_at?: string | null
  declined_reason?: string | null
}

export interface ContractEventPublic {
  type: string
  actor_name?: string | null
  actor_email?: string | null
  ip?: string | null
  occurred_at: string
}

export interface ContractCertificate {
  title: string
  document_sha256?: string | null
  consultant_name: string
  consultant_signed_at?: string | null
  client_name?: string | null
  client_signed_at?: string | null
  signer_email?: string | null
  status: ContractStatus
  events: ContractEventPublic[]
}

export interface TimeEntryResponse {
  id: string
  engagement_id: string
  entry_date: string
  minutes: number
  description?: string | null
  billable: boolean
  rate_cents_override?: number | null
  invoice_id?: string | null
  created_at: string
}

export interface InvoiceLineItem {
  id?: string
  description: string
  quantity: number
  unit_price_cents: number
  amount_cents: number
  sort_order?: number
}

export interface PaymentResponse {
  id: string
  amount_cents: number
  method?: PaymentMethod | null
  reference?: string | null
  paid_at: string
  note?: string | null
}

export interface InvoiceResponse {
  id: string
  engagement_id: string
  contact_id?: string | null
  organization_id?: string | null
  number: string
  status: InvoiceStatus
  issue_date: string
  due_date?: string | null
  currency: string
  subtotal_cents: number
  tax_cents: number
  total_cents: number
  amount_paid_cents: number
  is_retainer: boolean
  period_start?: string | null
  period_end?: string | null
  notes?: string | null
  public_token?: string | null
  sent_at?: string | null
  paid_at?: string | null
  reminder_sent_at?: string | null
  recipient_email?: string | null
  contact_name?: string | null
  created_at: string
  updated_at: string
  line_items: InvoiceLineItem[]
  payments: PaymentResponse[]
}

export type TemplateKind = 'contract' | 'invoice'
export interface Template {
  id: string
  kind: TemplateKind
  name: string
  title?: string | null
  scope_md?: string | null
  terms_md?: string | null
  total_value_cents?: number | null
  line_items?: InvoiceLineItem[] | null
  notes?: string | null
  currency: string
  created_at: string
  updated_at: string
}

export interface InvoicePublic {
  number: string
  status: InvoiceStatus
  issue_date: string
  due_date?: string | null
  currency: string
  subtotal_cents: number
  tax_cents: number
  total_cents: number
  amount_paid_cents: number
  notes?: string | null
  line_items: InvoiceLineItem[]
  bill_to_name?: string | null
  bill_to_company?: string | null
  consultant_name: string
  consultant_email: string
}

export interface EngagementDetail extends EngagementResponse {
  contracts: ContractResponse[]
  time_entries: TimeEntryResponse[]
  invoices: InvoiceResponse[]
}

export interface CrmDashboard {
  pipeline_counts: Record<string, number>
  pipeline_value_cents: number
  outstanding_ar_cents: number
  paid_this_month_cents: number
  mrr_cents: number
  unbilled_minutes: number
  contacts_count: number
  active_engagements: number
  overdue_invoices: InvoiceResponse[]
}

// ── API client ─────────────────────────────────────────────────────────────

export const api = {
  projects: {
    list: () => request<ProjectResponse[]>('GET', '/projects'),
    create: (data: Omit<ProjectResponse, 'id'>) =>
      request<ProjectResponse>('POST', '/projects', data),
    update: (id: number, data: Partial<Omit<ProjectResponse, 'id'>>) =>
      request<ProjectResponse>('PUT', `/projects/${id}`, data),
    delete: (id: number) => request<void>('DELETE', `/projects/${id}`),
  },

  skills: {
    list: () => request<SkillResponse[]>('GET', '/skills'),
    create: (data: Omit<SkillResponse, 'id'>) =>
      request<SkillResponse>('POST', '/skills', data),
    update: (id: number, data: Partial<Omit<SkillResponse, 'id'>>) =>
      request<SkillResponse>('PUT', `/skills/${id}`, data),
    delete: (id: number) => request<void>('DELETE', `/skills/${id}`),
  },

  experience: {
    list: () => request<ExperienceResponse[]>('GET', '/experience'),
    create: (data: Omit<ExperienceResponse, 'id'>) =>
      request<ExperienceResponse>('POST', '/experience', data),
    update: (id: number, data: Partial<Omit<ExperienceResponse, 'id'>>) =>
      request<ExperienceResponse>('PUT', `/experience/${id}`, data),
    delete: (id: number) => request<void>('DELETE', `/experience/${id}`),
  },

  about: {
    get: () => request<AboutResponse>('GET', '/about'),
    update: (data: Partial<Omit<AboutResponse, 'id'>>) =>
      request<AboutResponse>('PUT', '/about', data),
  },

  interests: {
    list: () => request<InterestResponse[]>('GET', '/about/interests'),
    create: (data: Omit<InterestResponse, 'id'>) =>
      request<InterestResponse>('POST', '/about/interests', data),
    update: (id: number, data: Partial<Omit<InterestResponse, 'id'>>) =>
      request<InterestResponse>('PUT', `/about/interests/${id}`, data),
    delete: (id: number) => request<void>('DELETE', `/about/interests/${id}`),
  },

  testimonials: {
    list: () => request<TestimonialResponse[]>('GET', '/about/testimonials'),
    create: (data: Omit<TestimonialResponse, 'id'>) =>
      request<TestimonialResponse>('POST', '/about/testimonials', data),
    update: (id: number, data: Partial<Omit<TestimonialResponse, 'id'>>) =>
      request<TestimonialResponse>('PUT', `/about/testimonials/${id}`, data),
    delete: (id: number) => request<void>('DELETE', `/about/testimonials/${id}`),
  },

  coursework: {
    list: () => request<CourseworkResponse[]>('GET', '/about/coursework'),
    create: (data: Omit<CourseworkResponse, 'id'>) =>
      request<CourseworkResponse>('POST', '/about/coursework', data),
    update: (id: number, data: Partial<Omit<CourseworkResponse, 'id'>>) =>
      request<CourseworkResponse>('PUT', `/about/coursework/${id}`, data),
    delete: (id: number) => request<void>('DELETE', `/about/coursework/${id}`),
  },

  certifications: {
    list: () => request<CertificationResponse[]>('GET', '/about/certifications'),
    create: (data: Partial<Omit<CertificationResponse, 'id' | 'tracked_link_id' | 'verify_slug'>>) =>
      request<CertificationResponse>('POST', '/about/certifications', data),
    update: (id: number, data: Partial<Omit<CertificationResponse, 'id' | 'tracked_link_id' | 'verify_slug'>>) =>
      request<CertificationResponse>('PUT', `/about/certifications/${id}`, data),
    delete: (id: number) => request<void>('DELETE', `/about/certifications/${id}`),
  },

  contact: {
    get: () => request<ContactMetaResponse>('GET', '/contact'),
    update: (data: Partial<Omit<ContactMetaResponse, 'id'>>) =>
      request<ContactMetaResponse>('PUT', '/contact', data),
    submit: (data: ContactSubmitRequest) => request<void>('POST', '/contact/submit', data),
  },

  socials: {
    list: () => request<SocialResponse[]>('GET', '/contact/socials'),
    create: (data: Omit<SocialResponse, 'id'>) =>
      request<SocialResponse>('POST', '/contact/socials', data),
    update: (id: number, data: Partial<Omit<SocialResponse, 'id'>>) =>
      request<SocialResponse>('PUT', `/contact/socials/${id}`, data),
    delete: (id: number) => request<void>('DELETE', `/contact/socials/${id}`),
  },

  blog: {
    list: (q?: string) => request<BlogPostResponse[]>('GET', q ? `/blog?q=${encodeURIComponent(q)}` : '/blog'),
    listAll: () => request<BlogPostResponse[]>('GET', '/blog/admin'),
    get: (slug: string) => request<BlogPostResponse>('GET', `/blog/${slug}`),
    view: (slug: string) => request<void>('POST', `/blog/${slug}/view`),
    create: (data: Omit<BlogPostResponse, 'id' | 'created_at' | 'updated_at'>) =>
      request<BlogPostResponse>('POST', '/blog', data),
    update: (id: number, data: Partial<Omit<BlogPostResponse, 'id' | 'created_at' | 'updated_at'>>) =>
      request<BlogPostResponse>('PUT', `/blog/${id}`, data),
    delete: (id: number) => request<void>('DELETE', `/blog/${id}`),
  },

  newsletter: {
    subscribe: (email: string, honeypot?: string) =>
      request<void>('POST', '/newsletter/subscribe', { email, honeypot }),
  },

  siteContent: {
    get: <T = unknown>(key: string) =>
      request<SiteContentResponse<T>>('GET', `/site-content/${key}`),
    update: <T = unknown>(key: string, data: T) =>
      request<SiteContentResponse<T>>('PUT', `/site-content/${key}`, { data }),
  },

  health: {
    services: () => request<ServiceHealthResponse>('GET', '/health/services'),
  },

  auth: {
    login: (username: string, password: string) =>
      request<void>('POST', '/auth/login', { username, password }),
    logout: () => request<void>('POST', '/auth/logout'),
    verify: () => request<void>('GET', '/auth/verify'),
  },

  aboutPage: {
    get: () => request<AboutPageResponse>('GET', '/about-page'),
  },

  contactPage: {
    get: () => request<ContactPageResponse>('GET', '/contact-page'),
  },

  links: {
    list: () => request<TrackedLinkResponse[]>('GET', '/links'),
    create: (data: Omit<TrackedLinkResponse, 'id' | 'clicks'>) =>
      request<TrackedLinkResponse>('POST', '/links', data),
    update: (id: number, data: Partial<Omit<TrackedLinkResponse, 'id' | 'clicks'>>) =>
      request<TrackedLinkResponse>('PUT', `/links/${id}`, data),
    delete: (id: number) => request<void>('DELETE', `/links/${id}`),
    getCtx: (slug: string) => request<PortfolioCtx>('GET', `/links/ctx/${slug}`),
  },

  testimonialRequests: {
    list: () => request<TestimonialRequestResponse[]>('GET', '/testimonial-requests'),
    create: (data: { slug: string; requester_name: string; requester_email?: string; requester_role?: string; personal_message?: string }) =>
      request<TestimonialRequestResponse>('POST', '/testimonial-requests', data),
    sendEmail: (id: number) => request<{ ok: boolean }>('POST', `/testimonial-requests/${id}/send-email`),
    approve: (id: number) => request<TestimonialRequestResponse>('POST', `/testimonial-requests/${id}/approve`),
    reject: (id: number) => request<TestimonialRequestResponse>('POST', `/testimonial-requests/${id}/reject`),
    delete: (id: number) => request<void>('DELETE', `/testimonial-requests/${id}`),
  },

  home: {
    get: () => request<HomeResponse>('GET', '/home'),
  },

  search: (q: string) =>
    request<{ results: SearchResult[] }>('GET', `/search?q=${encodeURIComponent(q)}`),

  resume: {
    data: () => request<ResumeDataResponse>('GET', '/resume/data'),
    variants: {
      list: () => request<ResumeVariantResponse[]>('GET', '/resume/variants'),
      create: (data: Partial<Omit<ResumeVariantResponse, 'id'>>) =>
        request<ResumeVariantResponse>('POST', '/resume/variants', data),
      update: (id: number, data: Partial<Omit<ResumeVariantResponse, 'id'>>) =>
        request<ResumeVariantResponse>('PUT', `/resume/variants/${id}`, data),
      delete: (id: number) => request<void>('DELETE', `/resume/variants/${id}`),
    },
  },

  github: {
    profile: () => request<GitHubProfile>('GET', '/github/profile'),
    repos: () => request<GitHubRepo[]>('GET', '/github/repos'),
    contributions: () => request<GitHubContributions>('GET', '/github/contributions'),
  },

  claude: {
    usage: () => request<ClaudeUsage>('GET', '/claude/usage'),
  },

  status: {
    get: () => request<DevStatusResponse>('GET', '/status'),
  },

  solar: {
    get: () => request<SolarResponse>('GET', '/solar'),
  },

  storage: {
    upload: async (file: File, prefix = 'uploads'): Promise<UploadResponse> => {
      const form = new FormData()
      form.append('file', file)
      const token = localStorage.getItem('admin_token')
      const res = await fetch(`${API_BASE}/storage/upload?prefix=${encodeURIComponent(prefix)}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      })
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
      return res.json()
    },
    list: (prefix = '') => request<{ files: StorageFile[] }>('GET', `/storage/files?prefix=${encodeURIComponent(prefix)}`),
    delete: (key: string) => request<{ deleted: string }>('DELETE', `/storage/files/${key}`),
    downloadUrl: (key: string) => `${API_BASE}/storage/download/${key}`,
  },

  bookings: {
    settingsPublic: () => request<BookingSettingsResponse>('GET', '/bookings/settings/public'),
    slots: (date: string) => request<AvailableSlot[]>('GET', `/bookings/slots?date=${date}`),
    create: (data: { visitor_name: string; visitor_email: string; topic: string; start_at: string; duration_minutes: number; honeypot?: string }) =>
      request<BookingResponse>('POST', '/bookings', data),
    list: (status?: string) => request<BookingResponse[]>('GET', status ? `/bookings?status=${status}` : '/bookings'),
    accept: (id: number, data?: { admin_note?: string }) =>
      request<BookingResponse>('PUT', `/bookings/${id}/accept`, data),
    decline: (id: number, data?: { admin_note?: string }) =>
      request<BookingResponse>('PUT', `/bookings/${id}/decline`, data),
    delete: (id: number) => request<void>('DELETE', `/bookings/${id}`),
    adminCreate: (data: { visitor_name: string; visitor_email: string; topic: string; start_at: string; duration_minutes: number }) =>
      request<BookingResponse>('POST', '/bookings/admin-create', data),
    availability: {
      list: () => request<AvailabilityWindowResponse[]>('GET', '/bookings/availability'),
      create: (data: Partial<AvailabilityWindowResponse>) =>
        request<AvailabilityWindowResponse>('POST', '/bookings/availability', data),
      update: (id: number, data: Partial<AvailabilityWindowResponse>) =>
        request<AvailabilityWindowResponse>('PUT', `/bookings/availability/${id}`, data),
      delete: (id: number) => request<void>('DELETE', `/bookings/availability/${id}`),
    },
    blockedDates: {
      list: () => request<DateOverrideResponse[]>('GET', '/bookings/blocked-dates'),
      create: (data: { date: string; reason?: string }) =>
        request<DateOverrideResponse>('POST', '/bookings/blocked-dates', data),
      delete: (id: number) => request<void>('DELETE', `/bookings/blocked-dates/${id}`),
    },
    settings: {
      get: () => request<BookingSettingsResponse>('GET', '/bookings/settings'),
      update: (data: { timezone?: string; enabled?: boolean }) =>
        request<BookingSettingsResponse>('PUT', '/bookings/settings', data),
    },
  },

  internships: {
    dashboard: () => request<DashboardStats>('GET', '/internships/dashboard'),

    companies: {
      list: () => request<CompanyResponse[]>('GET', '/internships/companies'),
      create: (data: Partial<CompanyResponse>) =>
        request<CompanyResponse>('POST', '/internships/companies', data),
      update: (id: string, data: Partial<CompanyResponse>) =>
        request<CompanyResponse>('PUT', `/internships/companies/${id}`, data),
      delete: (id: string) => request<void>('DELETE', `/internships/companies/${id}`),
    },

    applications: {
      list: () => request<ApplicationListItem[]>('GET', '/internships/applications'),
      create: (data: Record<string, unknown>) =>
        request<ApplicationListItem>('POST', '/internships/applications', data),
      update: (id: string, data: Record<string, unknown>) =>
        request<ApplicationListItem>('PUT', `/internships/applications/${id}`, data),
      delete: (id: string) => request<void>('DELETE', `/internships/applications/${id}`),
      addStatus: (id: string, data: { status: string; note?: string }) =>
        request<void>('POST', `/internships/applications/${id}/status`, data),
      addTag: (appId: string, tagId: string) =>
        request<void>('POST', `/internships/applications/${appId}/tags/${tagId}`),
      removeTag: (appId: string, tagId: string) =>
        request<void>('DELETE', `/internships/applications/${appId}/tags/${tagId}`),
    },

    rounds: {
      list: (appId: string) =>
        request<InterviewRoundResponse[]>('GET', `/internships/applications/${appId}/rounds`),
      create: (appId: string, data: Partial<InterviewRoundResponse>) =>
        request<InterviewRoundResponse>('POST', `/internships/applications/${appId}/rounds`, data),
      update: (id: string, data: Partial<InterviewRoundResponse>) =>
        request<InterviewRoundResponse>('PUT', `/internships/rounds/${id}`, data),
      delete: (id: string) => request<void>('DELETE', `/internships/rounds/${id}`),
    },

    offers: {
      create: (appId: string, data: Partial<OfferResponse>) =>
        request<OfferResponse>('POST', `/internships/applications/${appId}/offer`, data),
      update: (id: string, data: Partial<OfferResponse>) =>
        request<OfferResponse>('PUT', `/internships/offers/${id}`, data),
    },

    tags: {
      list: () => request<TagResponse[]>('GET', '/internships/tags'),
      create: (data: { name: string; color?: string }) =>
        request<TagResponse>('POST', '/internships/tags', data),
      delete: (id: string) => request<void>('DELETE', `/internships/tags/${id}`),
    },
  },

  bio: {
    page: () => request<BioPagePublicResponse>('GET', '/bio'),
    links: {
      list: () => request<BioLinkResponse[]>('GET', '/bio/links'),
      create: (data: Omit<BioLinkResponse, 'id' | 'clicks'>) =>
        request<BioLinkResponse>('POST', '/bio/links', data),
      update: (id: number, data: Partial<Omit<BioLinkResponse, 'id' | 'clicks'>>) =>
        request<BioLinkResponse>('PUT', `/bio/links/${id}`, data),
      delete: (id: number) => request<void>('DELETE', `/bio/links/${id}`),
    },
    settings: {
      get: () => request<BioPageSettingsResponse>('GET', '/bio/settings'),
      update: (data: Partial<BioPageSettingsResponse>) =>
        request<BioPageSettingsResponse>('PUT', '/bio/settings', data),
    },
  },

  crm: {
    dashboard: () => request<CrmDashboard>('GET', '/crm/dashboard'),

    organizations: {
      list: () => request<OrganizationResponse[]>('GET', '/crm/organizations'),
      create: (data: Partial<OrganizationResponse>) =>
        request<OrganizationResponse>('POST', '/crm/organizations', data),
      update: (id: string, data: Partial<OrganizationResponse>) =>
        request<OrganizationResponse>('PUT', `/crm/organizations/${id}`, data),
      delete: (id: string) => request<void>('DELETE', `/crm/organizations/${id}`),
    },

    contacts: {
      list: (q?: string) =>
        request<ContactResponse[]>('GET', q ? `/crm/contacts?q=${encodeURIComponent(q)}` : '/crm/contacts'),
      get: (id: string) => request<ContactDetail>('GET', `/crm/contacts/${id}`),
      create: (data: Partial<ContactResponse>) =>
        request<ContactResponse>('POST', '/crm/contacts', data),
      update: (id: string, data: Partial<ContactResponse>) =>
        request<ContactResponse>('PUT', `/crm/contacts/${id}`, data),
      delete: (id: string) => request<void>('DELETE', `/crm/contacts/${id}`),
      addActivity: (id: string, data: { type: ActivityType; body_md?: string; engagement_id?: string }) =>
        request<ActivityResponse>('POST', `/crm/contacts/${id}/activities`, data),
    },

    deals: {
      list: () => request<DealResponse[]>('GET', '/crm/deals'),
      create: (data: Partial<DealResponse>) => request<DealResponse>('POST', '/crm/deals', data),
      update: (id: string, data: Partial<DealResponse>) =>
        request<DealResponse>('PUT', `/crm/deals/${id}`, data),
      setStage: (id: string, data: { stage: DealStage; lost_reason?: string }) =>
        request<{ deal: DealResponse; engagement?: EngagementResponse }>('POST', `/crm/deals/${id}/stage`, data),
      delete: (id: string) => request<void>('DELETE', `/crm/deals/${id}`),
    },

    engagements: {
      list: () => request<EngagementResponse[]>('GET', '/crm/engagements'),
      get: (id: string) => request<EngagementDetail>('GET', `/crm/engagements/${id}`),
      create: (data: Partial<EngagementResponse>) =>
        request<EngagementResponse>('POST', '/crm/engagements', data),
      update: (id: string, data: Partial<EngagementResponse>) =>
        request<EngagementResponse>('PUT', `/crm/engagements/${id}`, data),
      delete: (id: string) => request<void>('DELETE', `/crm/engagements/${id}`),
    },

    contracts: {
      create: (data: Partial<ContractResponse>) =>
        request<ContractResponse>('POST', '/crm/contracts', data),
      update: (id: string, data: Partial<ContractResponse>) =>
        request<ContractResponse>('PUT', `/crm/contracts/${id}`, data),
      send: (id: string) => request<ContractResponse>('POST', `/crm/contracts/${id}/send`),
      remind: (id: string) => request<ContractResponse>('POST', `/crm/contracts/${id}/remind`),
      delete: (id: string) => request<void>('DELETE', `/crm/contracts/${id}`),
      pdfUrl: (id: string) => `${API_BASE}/crm/contracts/${id}/pdf`,
    },

    timeEntries: {
      list: (engagementId: string, unbilled = false) =>
        request<TimeEntryResponse[]>('GET', `/crm/time-entries?engagement_id=${engagementId}${unbilled ? '&unbilled=true' : ''}`),
      create: (data: { engagement_id: string; entry_date: string; minutes: number; description?: string; billable?: boolean; rate_cents_override?: number }) =>
        request<TimeEntryResponse>('POST', '/crm/time-entries', data),
      update: (id: string, data: Partial<TimeEntryResponse>) =>
        request<TimeEntryResponse>('PUT', `/crm/time-entries/${id}`, data),
      delete: (id: string) => request<void>('DELETE', `/crm/time-entries/${id}`),
    },

    invoices: {
      list: (engagementId?: string) =>
        request<InvoiceResponse[]>('GET', engagementId ? `/crm/invoices?engagement_id=${engagementId}` : '/crm/invoices'),
      create: (data: { engagement_id: string; issue_date?: string; due_date?: string; currency?: string; tax_cents?: number; notes?: string; line_items?: InvoiceLineItem[] }) =>
        request<InvoiceResponse>('POST', '/crm/invoices', data),
      generate: (data: { engagement_id: string; mode: BillingType; due_date?: string; tax_cents?: number; period_start?: string; period_end?: string }) =>
        request<InvoiceResponse>('POST', '/crm/invoices/generate', data),
      update: (id: string, data: { status?: InvoiceStatus; issue_date?: string; due_date?: string; tax_cents?: number; notes?: string; line_items?: InvoiceLineItem[] }) =>
        request<InvoiceResponse>('PUT', `/crm/invoices/${id}`, data),
      send: (id: string) => request<InvoiceResponse>('POST', `/crm/invoices/${id}/send`),
      remind: (id: string) => request<InvoiceResponse>('POST', `/crm/invoices/${id}/remind`),
      recordPayment: (id: string, data: { amount_cents: number; method?: PaymentMethod; reference?: string; note?: string }) =>
        request<InvoiceResponse>('POST', `/crm/invoices/${id}/payments`, data),
      delete: (id: string) => request<void>('DELETE', `/crm/invoices/${id}`),
      pdfUrl: (id: string) => `${API_BASE}/crm/invoices/${id}/pdf`,
    },

    templates: {
      list: (kind?: TemplateKind) => request<Template[]>('GET', kind ? `/crm/templates?kind=${kind}` : '/crm/templates'),
      create: (data: Partial<Template>) => request<Template>('POST', '/crm/templates', data),
      update: (id: string, data: Partial<Template>) => request<Template>('PUT', `/crm/templates/${id}`, data),
      delete: (id: string) => request<void>('DELETE', `/crm/templates/${id}`),
    },

    public: {
      getInvoice: (token: string) => request<InvoicePublic>('GET', `/crm/public/invoices/${token}`),
      getContract: (token: string) => request<ContractPublic>('GET', `/crm/public/contracts/${token}`),
      acceptContract: (token: string, data: { accepted_name: string; email: string }) =>
        request<ContractPublic>('POST', `/crm/public/contracts/${token}/accept`, data),
      declineContract: (token: string, reason: string) =>
        request<ContractPublic>('POST', `/crm/public/contracts/${token}/decline`, { reason }),
      verifyStart: (token: string, email: string) =>
        request<{ ok: boolean }>('POST', `/crm/public/contracts/${token}/verify/start`, { email }),
      verifyConfirm: (token: string, email: string, code: string) =>
        request<{ verified: boolean; email: string }>('POST', `/crm/public/contracts/${token}/verify/confirm`, { email, code }),
      getCertificate: (token: string) => request<ContractCertificate>('GET', `/crm/public/contracts/${token}/certificate`),
      contractPdfUrl: (token: string) => `${API_BASE}/crm/public/contracts/${token}/pdf`,
    },
  },
}
