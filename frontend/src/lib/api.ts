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
  view_count: number
}

export interface ContactSubmitRequest {
  name: string
  email: string
  message: string
  honeypot?: string
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

// ── About Page Types ──────────────────────────────────────────────────────────

export interface AboutPageResponse {
  about: AboutResponse
  interests: InterestResponse[]
  coursework: CourseworkResponse[]
  experience: ExperienceResponse[]
  testimonials: TestimonialResponse[]
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
}

export interface GitHubContributions {
  total: number
  streak: number
  days: { date: string; level: number }[]
  activity: Record<string, { name: string; url: string }[]>
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
    list: () => request<BlogPostResponse[]>('GET', '/blog'),
    listAll: () => request<BlogPostResponse[]>('GET', '/blog/admin'),
    get: (slug: string) => request<BlogPostResponse>('GET', `/blog/${slug}`),
    view: (slug: string) => request<void>('POST', `/blog/${slug}/view`),
    create: (data: Omit<BlogPostResponse, 'id' | 'created_at' | 'updated_at'>) =>
      request<BlogPostResponse>('POST', '/blog', data),
    update: (id: number, data: Partial<Omit<BlogPostResponse, 'id' | 'created_at' | 'updated_at'>>) =>
      request<BlogPostResponse>('PUT', `/blog/${id}`, data),
    delete: (id: number) => request<void>('DELETE', `/blog/${id}`),
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
}
