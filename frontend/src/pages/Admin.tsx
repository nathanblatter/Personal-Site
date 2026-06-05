import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import {
  LayoutDashboard,
  FolderKanban,
  BarChart3,
  Briefcase,
  User,
  AtSign,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  Save,
  Eye,
  X,
  Check,
  Pencil,
  ExternalLink,
  BookOpen,
  Loader2,
  LogOut,
  FileText,
  Globe,
  EyeOff,
  Target,
  Building2,
  TrendingUp,
  Clock,
  MapPin,
  Link2,
  Upload,
  HardDrive,
  File,
  Download,
  Copy,
  Settings,
  Calendar,
  Video,
  Ban,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import {
  api,
  type ProjectResponse,
  type SkillResponse,
  type ExperienceResponse,
  type AboutResponse,
  type InterestResponse,
  type CourseworkResponse,
  type SocialResponse,
  type ContactMetaResponse,
  type BlogPostResponse,
  type ApplicationListItem,
  type CompanyResponse,
  type DashboardStats,
  type TagResponse as ITagResponse,
  type StorageFile,
  type TestimonialResponse,
  type TrackedLinkResponse,
  type TestimonialRequestResponse,
  type BookingResponse,
  type AvailabilityWindowResponse,
  type DateOverrideResponse,
  type BookingSettingsResponse,
} from '../lib/api'

/* ═══════════════════════════════════════════════
   SIDEBAR NAV CONFIG
   ═══════════════════════════════════════════════ */

const sections = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'skills', label: 'Skills', icon: BarChart3 },
  { id: 'experience', label: 'Experience', icon: Briefcase },
  { id: 'about', label: 'About', icon: User },
  { id: 'coursework', label: 'Coursework', icon: BookOpen },
  { id: 'contact', label: 'Contact', icon: AtSign },
  { id: 'blog', label: 'Blog', icon: FileText },
  { id: 'files', label: 'Files', icon: HardDrive },
  { id: 'links', label: 'Links', icon: Link2 },
  { id: 'bookings', label: 'Bookings', icon: Calendar },
  { id: 'internships', label: 'Internships', icon: Target },
]

/* ═══════════════════════════════════════════════
   REUSABLE PIECES
   ═══════════════════════════════════════════════ */

function AdminInput({ label, value, onChange, type = 'text', mono = false, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; mono?: boolean; placeholder?: string
}) {
  return (
    <div>
      <label className="block font-mono text-[11px] text-steel mb-1.5 tracking-wider uppercase">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3.5 py-2.5 bg-white border border-mist rounded-lg text-sm text-ink placeholder-silver focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all ${mono ? 'font-mono text-xs' : ''}`}
      />
    </div>
  )
}

function AdminTextarea({ label, value, onChange, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number
}) {
  return (
    <div>
      <label className="block font-mono text-[11px] text-steel mb-1.5 tracking-wider uppercase">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full px-3.5 py-2.5 bg-white border border-mist rounded-lg text-sm text-ink placeholder-silver focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all resize-none"
      />
    </div>
  )
}

function AdminSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className="block font-mono text-[11px] text-steel mb-1.5 tracking-wider uppercase">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none px-3.5 py-2.5 bg-white border border-mist rounded-lg text-sm text-ink focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all pr-10"
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-steel pointer-events-none" />
      </div>
    </div>
  )
}

function TagEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState('')
  const add = () => {
    const t = input.trim()
    if (t && !tags.includes(t)) { onChange([...tags, t]); setInput('') }
  }
  return (
    <div>
      <label className="block font-mono text-[11px] text-steel mb-1.5 tracking-wider uppercase">Tags</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1.5 font-mono text-[11px] px-2.5 py-1 rounded-full bg-blue-wash text-blue">
            {tag}
            <button onClick={() => onChange(tags.filter(t => t !== tag))} className="hover:text-ember transition-colors">
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="Add tag…"
          className="flex-1 px-3 py-2 bg-white border border-mist rounded-lg text-sm text-ink placeholder-silver focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all font-mono text-xs"
        />
        <button onClick={add} className="px-3 py-2 bg-cloud text-steel rounded-lg hover:bg-blue-wash hover:text-blue transition-all text-xs font-mono">
          Add
        </button>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    live: 'bg-teal/10 text-teal',
    wip: 'bg-blue/10 text-blue',
    archived: 'bg-silver/30 text-steel',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider ${colors[status] || colors.archived}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'live' ? 'bg-teal' : status === 'wip' ? 'bg-blue' : 'bg-silver'}`} />
      {status}
    </span>
  )
}

function VisibilityToggle({ value = 'show', onChange }: { value?: string; onChange: (v: string) => void }) {
  const opts = [
    { key: 'show', active: 'bg-steel/80 text-white' },
    { key: 'highlight', active: 'bg-blue text-white' },
    { key: 'hide', active: 'bg-ember/15 text-ember' },
  ]
  return (
    <div className="inline-flex rounded-lg border border-mist overflow-hidden shrink-0">
      {opts.map(({ key, active }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-2.5 py-1 font-mono text-[9px] uppercase tracking-wide transition-colors border-r border-mist last:border-r-0 ${value === key ? active : 'text-silver hover:text-steel hover:bg-cloud'}`}
        >
          {key}
        </button>
      ))}
    </div>
  )
}

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-snow border border-mist rounded-xl p-6 ${className}`}>
      {children}
    </div>
  )
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 bg-ink text-white rounded-xl shadow-xl shadow-ink/20"
    >
      <Check size={16} className="text-teal" />
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="text-steel hover:text-white transition-colors ml-2"><X size={14} /></button>
    </motion.div>
  )
}

function FileUploadButton({ prefix, onUploaded, label, accept, className = '' }: {
  prefix: string
  onUploaded: (url: string, key: string) => void
  label?: string
  accept?: string
  className?: string
}) {
  const [uploading, setUploading] = useState(false)
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const result = await api.storage.upload(file, prefix)
      const url = api.storage.downloadUrl(result.key)
      onUploaded(url, result.key)
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }
  return (
    <label className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg cursor-pointer transition-all text-xs font-mono ${uploading ? 'bg-mist text-silver cursor-wait' : 'bg-cloud text-steel hover:bg-blue-wash hover:text-blue'} ${className}`}>
      {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
      {label || 'Upload'}
      <input type="file" accept={accept} onChange={handleFile} className="hidden" disabled={uploading} />
    </label>
  )
}

/* ═══════════════════════════════════════════════
   MAIN ADMIN PAGE
   ═══════════════════════════════════════════════ */

export default function Admin() {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState('overview')
  const [isLoading, setIsLoading] = useState(true)

  // ── Data state ──────────────────────────────────────────────────────────
  const [projects, setProjects] = useState<ProjectResponse[]>([])
  const [skills, setSkills] = useState<SkillResponse[]>([])
  const [experience, setExperience] = useState<ExperienceResponse[]>([])
  const [about, setAbout] = useState<AboutResponse | null>(null)
  const [interests, setInterests] = useState<InterestResponse[]>([])
  const [coursework, setCoursework] = useState<CourseworkResponse[]>([])
  const [socials, setSocials] = useState<SocialResponse[]>([])
  const [contactMeta, setContactMeta] = useState<ContactMetaResponse | null>(null)
  const [testimonials, setTestimonials] = useState<TestimonialResponse[]>([])
  const [blogs, setBlogs] = useState<BlogPostResponse[]>([])
  const [editingBlog, setEditingBlog] = useState<number | null>(null)
  const [blogDraft, setBlogDraft] = useState<Partial<BlogPostResponse>>({})
  const [showBlogPreview, setShowBlogPreview] = useState(false)

  // ── Testimonial requests state ────────────────────────────────────────────
  const [testimonialReqs, setTestimonialReqs] = useState<TestimonialRequestResponse[]>([])
  const [tReqsLoaded, setTReqsLoaded] = useState(false)
  const [newReqForm, setNewReqForm] = useState({ slug: '', requester_name: '', requester_email: '', requester_role: '', personal_message: '' })
  const [showNewReqForm, setShowNewReqForm] = useState(false)
  const [expandedReq, setExpandedReq] = useState<number | null>(null)

  // ── Links state ───────────────────────────────────────────────────────────
  const [trackedLinks, setTrackedLinks] = useState<TrackedLinkResponse[]>([])
  const [linksLoaded, setLinksLoaded] = useState(false)
  const [expandedCtx, setExpandedCtx] = useState<number | null>(null)
  const [ctxTab, setCtxTab] = useState('hero')

  // ── Files state ───────────────────────────────────────────────────────────
  const [files, setFiles] = useState<StorageFile[]>([])
  const [filesLoaded, setFilesLoaded] = useState(false)
  const [filesPrefix, setFilesPrefix] = useState('')

  // ── Internship tracker state ────────────────────────────────────────────
  const [intApps, setIntApps] = useState<ApplicationListItem[]>([])
  const [, setIntCompanies] = useState<CompanyResponse[]>([])
  const [intDashboard, setIntDashboard] = useState<DashboardStats | null>(null)
  const [, setIntTags] = useState<ITagResponse[]>([])
  const [intView, setIntView] = useState<'dashboard' | 'pipeline' | 'list' | 'add'>('dashboard')
  const [intEditing, setIntEditing] = useState<string | null>(null)
  const [intLoaded, setIntLoaded] = useState(false)
  const [intForm, setIntForm] = useState<Record<string, string>>({
    company_name: '', job_title: '', team: '', role_type: 'internship',
    work_arrangement: '', location_city: '', posting_url: '',
    current_status: 'wishlist', priority: 'medium', source: '',
    applied_on: '', next_action: '', next_action_due: '', personal_notes: '',
  })

  // ── Bookings state ──────────────────────────────────────────────────────
  const [bkBookings, setBkBookings] = useState<BookingResponse[]>([])
  const [bkWindows, setBkWindows] = useState<AvailabilityWindowResponse[]>([])
  const [bkBlocked, setBkBlocked] = useState<DateOverrideResponse[]>([])
  const [bkSettings, setBkSettings] = useState<BookingSettingsResponse | null>(null)
  const [bkLoaded, setBkLoaded] = useState(false)
  const [bkTab, setBkTab] = useState<'pending' | 'upcoming' | 'past' | 'settings'>('pending')
  const [bkDeclineNote, setBkDeclineNote] = useState<Record<number, string>>({})
  const [bkShowDecline, setBkShowDecline] = useState<number | null>(null)
  const [bkShowBlockPicker, setBkShowBlockPicker] = useState(false)
  const [bkBlockMonth, setBkBlockMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
  const [bkBlockReason, setBkBlockReason] = useState('')
  const [bkConfirmAction, setBkConfirmAction] = useState<{ type: 'accept' | 'decline' | 'cancel'; id: number } | null>(null)
  const [bkPastSort, setBkPastSort] = useState<'date' | 'name' | 'status'>('date')
  const [bkPastFilter, setBkPastFilter] = useState<string>('all')
  const [bkCopied, setBkCopied] = useState<number | null>(null)

  // ── Local bio state (derived from about.bio_paragraphs) ─────────────────
  const [headline, setHeadline] = useState('')
  const [bio, setBio] = useState('')
  const [hobbies, setHobbies] = useState('')

  // ── UI state ─────────────────────────────────────────────────────────────
  const [editingProject, setEditingProject] = useState<number | null>(null)
  const [editingExp, setEditingExp] = useState<number | null>(null)
  const [editingSocial, setEditingSocial] = useState<number | null>(null)
  const [newCourseName, setNewCourseName] = useState('')
  const [addingCourse, setAddingCourse] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }
  const showError = (msg: string) => showToast(`Error: ${msg}`)

  // ── Unsaved changes warning ────────────────────────────────────────────
  useEffect(() => {
    const hasUnsaved = editingProject !== null || editingBlog !== null || editingExp !== null || editingSocial !== null
    if (!hasUnsaved) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [editingProject, editingBlog, editingExp, editingSocial])

  // ── Initial data load ────────────────────────────────────────────────────
  useEffect(() => {
    api.auth.verify().catch(() => { navigate('/admin/login'); return })

    Promise.all([
      api.projects.list(),
      api.skills.list(),
      api.experience.list(),
      api.about.get(),
      api.interests.list(),
      api.coursework.list(),
      api.contact.get(),
      api.socials.list(),
      api.blog.listAll(),
      api.testimonials.list(),
    ]).then(([p, sk, ex, ab, intr, cw, cm, so, bl, test]) => {
      setProjects(p)
      setSkills(sk)
      setExperience(ex)
      setAbout(ab)
      setHeadline(ab.bio_paragraphs[0] ?? '')
      setBio(ab.bio_paragraphs[1] ?? '')
      setHobbies(ab.bio_paragraphs[2] ?? '')
      setInterests(intr)
      setCoursework(cw)
      setContactMeta(cm)
      setSocials(so)
      setBlogs(bl)
      setTestimonials(test)
    }).catch(err => {
      if ((err as Error).message.includes('401')) { navigate('/admin/login'); return }
      showError((err as Error).message)
    }).finally(() => setIsLoading(false))
  }, [navigate])

  // ── Lazy-load internship data when section is activated ─────────────────
  useEffect(() => {
    if (activeSection === 'about' && !tReqsLoaded) {
      api.testimonialRequests.list().then(r => { setTestimonialReqs(r); setTReqsLoaded(true) }).catch(err => showError((err as Error).message))
    }
    if (activeSection === 'links' && !linksLoaded) {
      api.links.list().then(l => { setTrackedLinks(l); setLinksLoaded(true) }).catch(err => showError((err as Error).message))
    }
    if (activeSection === 'files' && !filesLoaded) {
      api.storage.list(filesPrefix).then(res => {
        setFiles(res.files)
        setFilesLoaded(true)
      }).catch(err => showError((err as Error).message))
    }
    if (activeSection === 'bookings' && !bkLoaded) {
      Promise.all([
        api.bookings.list(),
        api.bookings.availability.list(),
        api.bookings.blockedDates.list(),
        api.bookings.settings.get(),
      ]).then(([bookings, windows, blocked, settings]) => {
        setBkBookings(bookings); setBkWindows(windows); setBkBlocked(blocked); setBkSettings(settings); setBkLoaded(true)
      }).catch(err => showError((err as Error).message))
    }
    if (activeSection !== 'internships' || intLoaded) return
    Promise.all([
      api.internships.dashboard(),
      api.internships.applications.list(),
      api.internships.companies.list(),
      api.internships.tags.list(),
    ]).then(([dash, apps, companies, tags]) => {
      setIntDashboard(dash)
      setIntApps(apps)
      setIntCompanies(companies)
      setIntTags(tags)
      setIntLoaded(true)
    }).catch(err => showError((err as Error).message))
  }, [activeSection, intLoaded, filesLoaded, filesPrefix, linksLoaded, tReqsLoaded, bkLoaded])

  const refreshInternships = async () => {
    try {
      const [dash, apps, companies, tags] = await Promise.all([
        api.internships.dashboard(),
        api.internships.applications.list(),
        api.internships.companies.list(),
        api.internships.tags.list(),
      ])
      setIntDashboard(dash)
      setIntApps(apps)
      setIntCompanies(companies)
      setIntTags(tags)
    } catch (err) {
      showError((err as Error).message)
    }
  }

  /* ── Projects ── */

  const updateProjectLocal = (id: number, field: string, value: unknown) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  const saveProject = async (project: ProjectResponse) => {
    try {
      const updated = await api.projects.update(project.id, project)
      setProjects(prev => prev.map(p => p.id === updated.id ? updated : p))
      setEditingProject(null)
      showToast('Project updated')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const addProject = async () => {
    try {
      const created = await api.projects.create({
        project_id: `project-${Date.now()}`,
        title: 'New Project',
        description: '',
        tags: [],
        year: '2026',
        color: '#3b6cf5',
        status: 'wip',
        link: '',
        images: [],
        metrics: [],
        sort_order: projects.length,
      })
      setProjects(prev => [created, ...prev])
      setEditingProject(created.id)
      showToast('Project created')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const deleteProject = async (id: number) => {
    try {
      await api.projects.delete(id)
      setProjects(prev => prev.filter(p => p.id !== id))
      if (editingProject === id) setEditingProject(null)
      showToast('Project deleted')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  /* ── Skills ── */

  const updateSkillLocal = (id: number, field: string, value: unknown) => {
    setSkills(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  const saveAllSkills = async () => {
    try {
      await Promise.all(skills.map(s => api.skills.update(s.id, s)))
      showToast('Skills saved')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const addSkill = async () => {
    try {
      const created = await api.skills.create({ name: 'New Skill', level: 50, category: 'Lang', sort_order: skills.length })
      setSkills(prev => [...prev, created])
      showToast('Skill added')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const deleteSkill = async (id: number) => {
    try {
      await api.skills.delete(id)
      setSkills(prev => prev.filter(s => s.id !== id))
      showToast('Skill removed')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  /* ── Experience ── */

  const updateExpLocal = (id: number, field: string, value: unknown) => {
    setExperience(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e))
  }

  const saveExp = async (exp: ExperienceResponse) => {
    try {
      const updated = await api.experience.update(exp.id, exp)
      setExperience(prev => prev.map(e => e.id === updated.id ? updated : e))
      setEditingExp(null)
      showToast('Experience updated')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const addExp = async () => {
    try {
      const created = await api.experience.create({
        year: '2026 — Present',
        title: 'New Position',
        subtitle: 'Company',
        description: '',
        active: false,
        sort_order: experience.length,
      })
      setExperience(prev => [...prev, created])
      setEditingExp(created.id)
      showToast('Experience added')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const deleteExp = async (id: number) => {
    try {
      await api.experience.delete(id)
      setExperience(prev => prev.filter(e => e.id !== id))
      if (editingExp === id) setEditingExp(null)
      showToast('Experience removed')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  /* ── About bio ── */

  const saveAbout = async () => {
    if (!about) return
    try {
      const updated = await api.about.update({ bio_paragraphs: [headline, bio, hobbies], gpa: about.gpa, looking_for: about.looking_for })
      setAbout(updated)
      showToast('Bio saved')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  /* ── Interests ── */

  const updateInterestLocal = (id: number, field: string, value: string) => {
    setInterests(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item))
  }

  const saveInterest = async (item: InterestResponse) => {
    try {
      const updated = await api.interests.update(item.id, item)
      setInterests(prev => prev.map(i => i.id === updated.id ? updated : i))
      showToast('Interest saved')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const addInterest = async () => {
    try {
      const created = await api.interests.create({
        icon: '',
        label: 'New Interest',
        desc: 'Description here',
        sort_order: interests.length,
      })
      setInterests(prev => [...prev, created])
      showToast('Interest added')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const deleteInterest = async (id: number) => {
    try {
      await api.interests.delete(id)
      setInterests(prev => prev.filter(i => i.id !== id))
      showToast('Interest removed')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  /* ── Coursework ── */

  const addCourse = async () => {
    const name = newCourseName.trim()
    if (!name) return
    try {
      const created = await api.coursework.create({ name, sort_order: coursework.length })
      setCoursework(prev => [...prev, created])
      setNewCourseName('')
      setAddingCourse(false)
      showToast('Course added')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const deleteCourse = async (id: number) => {
    try {
      await api.coursework.delete(id)
      setCoursework(prev => prev.filter(c => c.id !== id))
      showToast('Course removed')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  /* ── Socials ── */

  const updateSocialLocal = (id: number, field: string, value: string) => {
    setSocials(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  const saveSocial = async (social: SocialResponse) => {
    try {
      const updated = await api.socials.update(social.id, social)
      setSocials(prev => prev.map(s => s.id === updated.id ? updated : s))
      setEditingSocial(null)
      showToast('Social link updated')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const addSocial = async () => {
    try {
      const created = await api.socials.create({
        icon: 'Link',
        label: 'New Link',
        handle: '@handle',
        href: 'https://',
        sort_order: socials.length,
      })
      setSocials(prev => [...prev, created])
      setEditingSocial(created.id)
      showToast('Social link added')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const deleteSocial = async (id: number) => {
    try {
      await api.socials.delete(id)
      setSocials(prev => prev.filter(s => s.id !== id))
      if (editingSocial === id) setEditingSocial(null)
      showToast('Social link deleted')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  /* ── Contact meta ── */

  const saveContactMeta = async () => {
    if (!contactMeta) return
    try {
      const updated = await api.contact.update(contactMeta)
      setContactMeta(updated)
      showToast('Contact info saved')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  /* ── Blog ── */

  function slugify(title: string): string {
    return title.toLowerCase().trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s-]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  const openBlogEditor = (post: BlogPostResponse) => {
    setEditingBlog(post.id)
    setBlogDraft({ ...post })
    setShowBlogPreview(false)
  }

  const closeBlogEditor = () => {
    setEditingBlog(null)
    setBlogDraft({})
    setShowBlogPreview(false)
  }

  const updateBlogDraft = (field: keyof BlogPostResponse, value: unknown) => {
    setBlogDraft(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'title' && typeof value === 'string') {
        const currentSlug = prev.slug ?? ''
        const oldAuto = slugify(prev.title ?? '')
        if (!currentSlug || currentSlug === oldAuto) {
          next.slug = slugify(value)
        }
      }
      return next
    })
  }

  const saveBlog = async () => {
    if (!editingBlog || !blogDraft) return
    try {
      const updated = await api.blog.update(editingBlog, blogDraft)
      setBlogs(prev => prev.map(b => b.id === updated.id ? updated : b))
      closeBlogEditor()
      showToast('Post saved')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const addBlog = async () => {
    try {
      const created = await api.blog.create({
        slug: `post-${Date.now()}`,
        title: 'New Post',
        subtitle: '',
        content: '# New Post\n\nStart writing here…',
        excerpt: '',
        cover_image_url: '',
        tags: [],
        published: false,
        published_at: undefined,
      })
      setBlogs(prev => [created, ...prev])
      openBlogEditor(created)
      showToast('Post created')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const deleteBlog = async (id: number) => {
    try {
      await api.blog.delete(id)
      setBlogs(prev => prev.filter(b => b.id !== id))
      if (editingBlog === id) closeBlogEditor()
      showToast('Post deleted')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  /* ── Loading screen ── */

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cloud flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-steel">
          <Loader2 size={32} className="animate-spin text-blue" />
          <span className="font-mono text-sm tracking-wider">Loading admin panel…</span>
        </div>
      </div>
    )
  }

  /* ── Section renderers ── */

  const renderOverview = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div>
        <h2 className="text-2xl font-sans font-semibold text-ink mb-1">Dashboard</h2>
        <p className="text-steel text-sm">Manage your portfolio content. All changes persist to the database.</p>
      </div>

      <div className="grid grid-cols-4 gap-5">
        {[
          { label: 'Projects', count: projects.length, live: projects.filter(p => p.status === 'live').length, color: 'blue' },
          { label: 'Skills', count: skills.length, live: null, color: 'violet' },
          { label: 'Experience', count: experience.length, live: experience.filter(e => e.active).length, color: 'teal' },
          { label: 'Courses', count: coursework.length, live: null, color: 'ember' },
        ].map(card => (
          <SectionCard key={card.label}>
            <div className="flex items-start justify-between mb-4">
              <span className="font-mono text-[11px] text-steel tracking-wider uppercase">{card.label}</span>
              <span className={`w-2 h-2 rounded-full bg-${card.color} mt-1`} />
            </div>
            <p className="text-3xl font-sans font-bold text-ink">{card.count}</p>
            {card.live !== null && (
              <p className="text-xs text-steel mt-1 font-mono">{card.live} active</p>
            )}
          </SectionCard>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <SectionCard>
          <h3 className="font-sans font-semibold text-ink mb-4 flex items-center gap-2">
            <FolderKanban size={16} className="text-blue" /> Recent Projects
          </h3>
          <div className="space-y-3">
            {projects.slice(0, 4).map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-white border border-mist">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                  <span className="text-sm text-ink font-medium">{p.title}</span>
                </div>
                <StatusBadge status={p.status} />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard>
          <h3 className="font-sans font-semibold text-ink mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-blue" /> Top Skills
          </h3>
          <div className="space-y-3">
            {skills.slice(0, 5).map(s => (
              <div key={s.id} className="flex items-center gap-3">
                <span className="text-sm text-ink flex-1">{s.name}</span>
                <div className="w-32 h-2 bg-cloud rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-dim to-blue-light" style={{ width: `${s.level}%` }} />
                </div>
                <span className="font-mono text-[11px] text-steel w-8 text-right">{s.level}%</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </motion.div>
  )

  const renderProjects = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-sans font-semibold text-ink mb-1">Projects</h2>
          <p className="text-steel text-sm">{projects.length} total — {projects.filter(p => p.status === 'live').length} live, {projects.filter(p => p.status === 'wip').length} WIP</p>
        </div>
        <button onClick={addProject} className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors shadow-sm">
          <Plus size={14} /> Add Project
        </button>
      </div>

      <div className="space-y-3">
        {projects.map(project => (
          <SectionCard key={project.id} className="!p-0 overflow-hidden">
            <div
              className="flex items-center gap-4 p-5 cursor-pointer hover:bg-cloud/50 transition-colors"
              onClick={() => setEditingProject(editingProject === project.id ? null : project.id)}
            >
              <GripVertical size={14} className="text-silver" />
              <div className="w-4 h-4 rounded-md border border-mist" style={{ background: project.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-ink truncate">{project.title}</span>
                  <StatusBadge status={project.status} />
                </div>
                <p className="text-xs text-steel truncate mt-0.5">{project.description}</p>
              </div>
              <span className="font-mono text-xs text-silver shrink-0">{project.year}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                {project.link && (
                  <a href={project.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="p-1.5 text-steel hover:text-blue transition-colors">
                    <ExternalLink size={13} />
                  </a>
                )}
                <button onClick={e => { e.stopPropagation(); setEditingProject(editingProject === project.id ? null : project.id) }} className="p-1.5 text-steel hover:text-blue transition-colors">
                  <Pencil size={13} />
                </button>
                <button onClick={e => { e.stopPropagation(); deleteProject(project.id) }} className="p-1.5 text-steel hover:text-ember transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            <AnimatePresence>
              {editingProject === project.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-mist p-6 bg-white space-y-5">
                    <div className="grid grid-cols-2 gap-5">
                      <AdminInput label="Title" value={project.title} onChange={v => updateProjectLocal(project.id, 'title', v)} />
                      <AdminInput label="Year" value={project.year} onChange={v => updateProjectLocal(project.id, 'year', v)} mono />
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <AdminInput label="Slug (project_id)" value={project.project_id} onChange={v => updateProjectLocal(project.id, 'project_id', v)} mono placeholder="my-project-slug" />
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="font-mono text-[11px] text-steel tracking-wider uppercase">Link / Document URL</label>
                          <FileUploadButton
                            prefix="projects/docs"
                            label="Upload Doc"
                            onUploaded={url => updateProjectLocal(project.id, 'link', url)}
                          />
                        </div>
                        <input
                          value={project.link || ''}
                          onChange={e => updateProjectLocal(project.id, 'link', e.target.value)}
                          placeholder="https://… or upload a document →"
                          className="w-full px-3.5 py-2.5 bg-white border border-mist rounded-lg text-xs text-ink font-mono placeholder-silver focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all"
                        />
                      </div>
                    </div>
                    <AdminTextarea label="Description" value={project.description} onChange={v => updateProjectLocal(project.id, 'description', v)} />

                    {/* Screenshots */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="font-mono text-[11px] text-steel tracking-wider uppercase">Screenshots</label>
                        <FileUploadButton
                          prefix={`projects/images/${project.project_id}`}
                          accept="image/*"
                          label="Add Image"
                          onUploaded={url => updateProjectLocal(project.id, 'images', [...(project.images || []), url])}
                        />
                      </div>
                      {(project.images?.length ?? 0) > 0 ? (
                        <div className="flex gap-3 overflow-x-auto pb-2">
                          {project.images!.map((img, i) => (
                            <div key={i} className="relative shrink-0 group">
                              <img src={img} alt={`Screenshot ${i + 1}`} className="h-24 w-36 rounded-lg object-cover border border-mist" />
                              <button
                                onClick={() => updateProjectLocal(project.id, 'images', project.images!.filter((_, j) => j !== i))}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-ember text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-silver font-mono py-3">No screenshots yet. Upload images to show in the project modal.</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <AdminSelect
                        label="Status"
                        value={project.status}
                        onChange={v => updateProjectLocal(project.id, 'status', v)}
                        options={[
                          { value: 'live', label: 'Live' },
                          { value: 'wip', label: 'WIP' },
                          { value: 'archived', label: 'Archived' },
                        ]}
                      />
                      <div>
                        <label className="block font-mono text-[11px] text-steel mb-1.5 tracking-wider uppercase">Color</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={project.color}
                            onChange={e => updateProjectLocal(project.id, 'color', e.target.value)}
                            className="w-10 h-10 rounded-lg border border-mist cursor-pointer"
                          />
                          <input
                            value={project.color}
                            onChange={e => updateProjectLocal(project.id, 'color', e.target.value)}
                            className="flex-1 px-3 py-2.5 bg-white border border-mist rounded-lg text-xs text-ink font-mono focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all"
                          />
                        </div>
                      </div>
                    </div>
                    <TagEditor tags={project.tags} onChange={tags => updateProjectLocal(project.id, 'tags', tags)} />

                    {/* Metrics */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="font-mono text-[11px] text-steel tracking-wider uppercase">Metrics</label>
                        <button
                          onClick={() => updateProjectLocal(project.id, 'metrics', [...(project.metrics || []), { label: '', value: '' }])}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono text-blue bg-blue-wash rounded-lg hover:bg-blue/10 transition-colors"
                        >
                          <Plus size={10} /> Add
                        </button>
                      </div>
                      {(project.metrics?.length ?? 0) > 0 ? (
                        <div className="space-y-2">
                          {project.metrics!.map((m, mi) => (
                            <div key={mi} className="flex items-center gap-2">
                              <input
                                value={m.value}
                                onChange={e => {
                                  const next = [...project.metrics!]
                                  next[mi] = { ...next[mi], value: e.target.value }
                                  updateProjectLocal(project.id, 'metrics', next)
                                }}
                                placeholder="200+"
                                className="w-24 px-2.5 py-2 bg-white border border-mist rounded-lg text-xs text-ink font-semibold focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all text-center"
                              />
                              <input
                                value={m.label}
                                onChange={e => {
                                  const next = [...project.metrics!]
                                  next[mi] = { ...next[mi], label: e.target.value }
                                  updateProjectLocal(project.id, 'metrics', next)
                                }}
                                placeholder="dev hours"
                                className="flex-1 px-2.5 py-2 bg-white border border-mist rounded-lg text-xs text-ink font-mono focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all"
                              />
                              <button
                                onClick={() => updateProjectLocal(project.id, 'metrics', project.metrics!.filter((_, j) => j !== mi))}
                                className="p-1.5 text-steel hover:text-ember transition-colors"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-silver font-mono py-2">No metrics. Add stats like "200+ dev hours" or "1,000 users".</p>
                      )}
                    </div>

                    <div className="flex justify-end pt-2">
                      <button onClick={() => saveProject(project)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors">
                        <Save size={13} /> Save Changes
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </SectionCard>
        ))}
      </div>
    </motion.div>
  )

  const renderSkills = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-sans font-semibold text-ink mb-1">Skills</h2>
          <p className="text-steel text-sm">{skills.length} skills across {new Set(skills.map(s => s.category)).size} categories</p>
        </div>
        <button onClick={addSkill} className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors shadow-sm">
          <Plus size={14} /> Add Skill
        </button>
      </div>

      <SectionCard className="!p-0 overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-0 text-[11px] font-mono text-steel tracking-wider uppercase px-6 py-3 border-b border-mist bg-cloud/50">
          <span>Skill</span>
          <span className="w-20 text-center">Category</span>
          <span className="w-28 text-center">Level</span>
          <span className="w-16"></span>
        </div>
        {skills.map(skill => (
          <div key={skill.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-0 items-center px-6 py-3.5 border-b border-mist last:border-b-0 hover:bg-cloud/30 transition-colors">
            <input
              value={skill.name}
              onChange={e => updateSkillLocal(skill.id, 'name', e.target.value)}
              className="text-sm text-ink bg-transparent focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue/10 rounded px-2 py-1 -ml-2 transition-all"
            />
            <div className="w-20">
              <select
                value={skill.category}
                onChange={e => updateSkillLocal(skill.id, 'category', e.target.value)}
                className="appearance-none font-mono text-[11px] text-steel bg-transparent focus:outline-none focus:bg-white rounded px-2 py-1 text-center cursor-pointer"
              >
                {['Web', 'Lang', 'Data', 'Front', 'Back', 'Cloud', 'BI', 'IS'].map(c =>
                  <option key={c} value={c}>{c}</option>
                )}
              </select>
            </div>
            <div className="w-28 flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                value={skill.level}
                onChange={e => updateSkillLocal(skill.id, 'level', parseInt(e.target.value))}
                className="w-16 accent-blue"
              />
              <span className="font-mono text-xs text-steel w-8 text-right">{skill.level}%</span>
            </div>
            <div className="w-16 flex justify-end">
              <button onClick={() => deleteSkill(skill.id)} className="p-1.5 text-silver hover:text-ember transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </SectionCard>

      <div className="flex justify-end">
        <button onClick={saveAllSkills} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors">
          <Save size={13} /> Save All
        </button>
      </div>
    </motion.div>
  )

  const renderExperience = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-sans font-semibold text-ink mb-1">Experience</h2>
          <p className="text-steel text-sm">{experience.length} entries — {experience.filter(e => e.active).length} currently active</p>
        </div>
        <button onClick={addExp} className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors shadow-sm">
          <Plus size={14} /> Add Entry
        </button>
      </div>

      <div className="space-y-3">
        {experience.map(exp => (
          <SectionCard key={exp.id} className="!p-0 overflow-hidden">
            <div
              className="flex items-center gap-4 p-5 cursor-pointer hover:bg-cloud/50 transition-colors"
              onClick={() => setEditingExp(editingExp === exp.id ? null : exp.id)}
            >
              <GripVertical size={14} className="text-silver" />
              <div className={`w-3 h-3 rounded-full border-2 ${exp.active ? 'bg-blue border-blue' : 'bg-white border-silver'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-ink">{exp.title}</span>
                  {exp.active && <span className="font-mono text-[10px] text-teal bg-teal/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Active</span>}
                </div>
                <p className="text-xs text-steel mt-0.5">{exp.subtitle}</p>
              </div>
              <span className="font-mono text-xs text-silver shrink-0">{exp.year}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={e => { e.stopPropagation(); setEditingExp(editingExp === exp.id ? null : exp.id) }} className="p-1.5 text-steel hover:text-blue transition-colors">
                  <Pencil size={13} />
                </button>
                <button onClick={e => { e.stopPropagation(); deleteExp(exp.id) }} className="p-1.5 text-steel hover:text-ember transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            <AnimatePresence>
              {editingExp === exp.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-mist p-6 bg-white space-y-5">
                    <div className="grid grid-cols-2 gap-5">
                      <AdminInput label="Title" value={exp.title} onChange={v => updateExpLocal(exp.id, 'title', v)} />
                      <AdminInput label="Date Range" value={exp.year} onChange={v => updateExpLocal(exp.id, 'year', v)} mono />
                    </div>
                    <AdminInput label="Organization" value={exp.subtitle} onChange={v => updateExpLocal(exp.id, 'subtitle', v)} />
                    <AdminTextarea label="Description" value={exp.description} onChange={v => updateExpLocal(exp.id, 'description', v)} />
                    <div className="flex items-center gap-3">
                      <label className="font-mono text-[11px] text-steel tracking-wider uppercase">Currently Active</label>
                      <button
                        onClick={() => updateExpLocal(exp.id, 'active', !exp.active)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${exp.active ? 'bg-blue' : 'bg-silver'}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${exp.active ? 'left-6' : 'left-1'}`} />
                      </button>
                    </div>
                    <div className="flex justify-end pt-2">
                      <button onClick={() => saveExp(exp)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors">
                        <Save size={13} /> Save Changes
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </SectionCard>
        ))}
      </div>
    </motion.div>
  )

  const renderAbout = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div>
        <h2 className="text-2xl font-sans font-semibold text-ink mb-1">About Page</h2>
        <p className="text-steel text-sm">Edit your bio, interests, and personal details.</p>
      </div>

      <SectionCard>
        <h3 className="font-sans font-semibold text-ink mb-5">Bio</h3>
        <div className="space-y-5">
          <AdminTextarea label="Headline" value={headline} onChange={setHeadline} rows={2} />
          <AdminTextarea label="Main Paragraph" value={bio} onChange={setBio} rows={3} />
          <AdminTextarea label="Hobbies & Personal" value={hobbies} onChange={setHobbies} rows={2} />
          <AdminInput label="GPA" value={about?.gpa ?? ''} onChange={v => setAbout(prev => prev ? { ...prev, gpa: v } : prev)} placeholder="e.g. 3.64" mono />
        </div>
        <div className="flex justify-end pt-5">
          <button onClick={saveAbout} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors">
            <Save size={13} /> Save Bio
          </button>
        </div>
      </SectionCard>

      <SectionCard>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-sans font-semibold text-ink">Focus Areas / Interests</h3>
          <button onClick={addInterest} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-blue bg-blue-wash rounded-lg hover:bg-blue/10 transition-colors">
            <Plus size={12} /> Add
          </button>
        </div>
        <div className="space-y-3">
          {interests.map(item => (
            <div key={item.id} className="grid grid-cols-[auto_1fr_1fr_auto] gap-4 items-start p-4 rounded-lg bg-white border border-mist">
              <input
                value={item.icon}
                onChange={e => updateInterestLocal(item.id, 'icon', e.target.value)}
                className="w-20 text-sm text-steel font-mono bg-transparent focus:outline-none focus:bg-snow focus:ring-2 focus:ring-blue/10 rounded px-2 py-1.5 transition-all border border-mist"
                placeholder="icon"
              />
              <input
                value={item.label}
                onChange={e => updateInterestLocal(item.id, 'label', e.target.value)}
                className="text-sm text-ink font-medium bg-transparent focus:outline-none focus:bg-snow focus:ring-2 focus:ring-blue/10 rounded px-2 py-1.5 -ml-2 transition-all"
                placeholder="Interest name"
              />
              <input
                value={item.desc}
                onChange={e => updateInterestLocal(item.id, 'desc', e.target.value)}
                className="text-sm text-steel bg-transparent focus:outline-none focus:bg-snow focus:ring-2 focus:ring-blue/10 rounded px-2 py-1.5 transition-all"
                placeholder="Short description"
              />
              <div className="flex items-center gap-1 mt-1">
                <button onClick={() => saveInterest(item)} className="p-1.5 text-steel hover:text-blue transition-colors">
                  <Save size={13} />
                </button>
                <button onClick={() => deleteInterest(item.id)} className="p-1.5 text-silver hover:text-ember transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Looking For */}
      <SectionCard>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-sans font-semibold text-ink">What I'm Looking For</h3>
          <button
            onClick={() => setAbout(prev => prev ? { ...prev, looking_for: [...(prev.looking_for || []), { role: '', location: '', timeline: '', detail: '' }] } : prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-blue bg-blue-wash rounded-lg hover:bg-blue/10 transition-colors"
          >
            <Plus size={12} /> Add
          </button>
        </div>
        <div className="space-y-3">
          {(about?.looking_for || []).map((item, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-start p-4 rounded-lg bg-white border border-mist">
              <input
                value={item.role}
                onChange={e => {
                  const next = [...(about?.looking_for || [])]
                  next[i] = { ...next[i], role: e.target.value }
                  setAbout(prev => prev ? { ...prev, looking_for: next } : prev)
                }}
                className="text-sm text-ink bg-transparent focus:outline-none focus:bg-snow focus:ring-2 focus:ring-blue/10 rounded px-2 py-1.5 transition-all border border-mist"
                placeholder="Role title"
              />
              <input
                value={item.location}
                onChange={e => {
                  const next = [...(about?.looking_for || [])]
                  next[i] = { ...next[i], location: e.target.value }
                  setAbout(prev => prev ? { ...prev, looking_for: next } : prev)
                }}
                className="text-sm text-steel bg-transparent focus:outline-none focus:bg-snow focus:ring-2 focus:ring-blue/10 rounded px-2 py-1.5 transition-all border border-mist"
                placeholder="Location"
              />
              <input
                value={item.timeline}
                onChange={e => {
                  const next = [...(about?.looking_for || [])]
                  next[i] = { ...next[i], timeline: e.target.value }
                  setAbout(prev => prev ? { ...prev, looking_for: next } : prev)
                }}
                className="text-sm text-steel bg-transparent focus:outline-none focus:bg-snow focus:ring-2 focus:ring-blue/10 rounded px-2 py-1.5 transition-all border border-mist"
                placeholder="Timeline"
              />
              <button
                onClick={() => setAbout(prev => prev ? { ...prev, looking_for: prev.looking_for.filter((_, j) => j !== i) } : prev)}
                className="p-1.5 text-silver hover:text-ember transition-colors mt-1"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-4">
          <button onClick={saveAbout} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors">
            <Save size={13} /> Save
          </button>
        </div>
      </SectionCard>

      {/* Testimonials */}
      <SectionCard>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-sans font-semibold text-ink">Testimonials</h3>
          <button
            onClick={async () => {
              try {
                const t = await api.testimonials.create({ name: 'New Person', role: 'Role', quote: 'Quote here...', sort_order: testimonials.length })
                setTestimonials(prev => [...prev, t])
                showToast('Testimonial added')
              } catch (err) { showError((err as Error).message) }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-blue bg-blue-wash rounded-lg hover:bg-blue/10 transition-colors"
          >
            <Plus size={12} /> Add
          </button>
        </div>
        <div className="space-y-3">
          {testimonials.map(t => (
            <div key={t.id} className="p-4 rounded-lg bg-white border border-mist space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={t.name}
                  onChange={e => setTestimonials(prev => prev.map(x => x.id === t.id ? { ...x, name: e.target.value } : x))}
                  className="text-sm text-ink font-medium bg-transparent focus:outline-none focus:bg-snow focus:ring-2 focus:ring-blue/10 rounded px-2 py-1.5 transition-all border border-mist"
                  placeholder="Name"
                />
                <input
                  value={t.role}
                  onChange={e => setTestimonials(prev => prev.map(x => x.id === t.id ? { ...x, role: e.target.value } : x))}
                  className="text-sm text-steel bg-transparent focus:outline-none focus:bg-snow focus:ring-2 focus:ring-blue/10 rounded px-2 py-1.5 transition-all border border-mist"
                  placeholder="Role / Title"
                />
              </div>
              <textarea
                value={t.quote}
                onChange={e => setTestimonials(prev => prev.map(x => x.id === t.id ? { ...x, quote: e.target.value } : x))}
                rows={2}
                className="w-full text-sm text-ink/80 bg-transparent focus:outline-none focus:bg-snow focus:ring-2 focus:ring-blue/10 rounded px-2 py-1.5 transition-all border border-mist resize-none"
                placeholder="Their quote..."
              />
              <div className="flex items-center justify-between">
                <input
                  value={t.avatar_url || ''}
                  onChange={e => setTestimonials(prev => prev.map(x => x.id === t.id ? { ...x, avatar_url: e.target.value } : x))}
                  className="flex-1 text-xs text-steel font-mono bg-transparent focus:outline-none focus:bg-snow focus:ring-2 focus:ring-blue/10 rounded px-2 py-1.5 transition-all border border-mist mr-2"
                  placeholder="Avatar URL (optional)"
                />
                <button
                  onClick={async () => {
                    try {
                      await api.testimonials.update(t.id, { name: t.name, role: t.role, quote: t.quote, avatar_url: t.avatar_url })
                      showToast('Saved')
                    } catch (err) { showError((err as Error).message) }
                  }}
                  className="p-1.5 text-steel hover:text-blue transition-colors"
                >
                  <Save size={13} />
                </button>
                <button
                  onClick={async () => {
                    try {
                      await api.testimonials.delete(t.id)
                      setTestimonials(prev => prev.filter(x => x.id !== t.id))
                      showToast('Deleted')
                    } catch (err) { showError((err as Error).message) }
                  }}
                  className="p-1.5 text-silver hover:text-ember transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          {testimonials.length === 0 && (
            <p className="text-center text-steel text-sm py-4 font-mono">No testimonials yet.</p>
          )}
        </div>
      </SectionCard>

      {/* Testimonial Requests */}
      <SectionCard>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-sans font-semibold text-ink">Testimonial Requests</h3>
            <p className="text-xs text-steel font-mono mt-0.5">Send personalized request links and approve submissions</p>
          </div>
          <button
            onClick={() => setShowNewReqForm(v => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-blue bg-blue-wash rounded-lg hover:bg-blue/10 transition-colors"
          >
            <Plus size={12} /> New Request
          </button>
        </div>

        {/* Create form */}
        {showNewReqForm && (
          <div className="mb-5 p-4 rounded-xl bg-snow border border-mist space-y-3">
            <p className="font-mono text-xs text-blue uppercase tracking-wider">New testimonial request</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-[10px] text-silver uppercase tracking-wider mb-1">Slug (URL)</label>
                <input
                  value={newReqForm.slug}
                  onChange={e => setNewReqForm(f => ({ ...f, slug: e.target.value }))}
                  placeholder="jamesgaskin"
                  className="w-full text-sm text-ink font-mono bg-white border border-mist rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue/20"
                />
                <p className="text-[10px] text-silver font-mono mt-1">→ /go/{newReqForm.slug || 'slug'}</p>
              </div>
              <div>
                <label className="block font-mono text-[10px] text-silver uppercase tracking-wider mb-1">Full name</label>
                <input
                  value={newReqForm.requester_name}
                  onChange={e => setNewReqForm(f => ({ ...f, requester_name: e.target.value }))}
                  placeholder="James Gaskin"
                  className="w-full text-sm text-ink bg-white border border-mist rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue/20"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] text-silver uppercase tracking-wider mb-1">Email (optional)</label>
                <input
                  value={newReqForm.requester_email}
                  onChange={e => setNewReqForm(f => ({ ...f, requester_email: e.target.value }))}
                  placeholder="james@example.com"
                  type="email"
                  className="w-full text-sm text-ink bg-white border border-mist rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue/20"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] text-silver uppercase tracking-wider mb-1">Their role (optional)</label>
                <input
                  value={newReqForm.requester_role}
                  onChange={e => setNewReqForm(f => ({ ...f, requester_role: e.target.value }))}
                  placeholder="Professor at BYU"
                  className="w-full text-sm text-ink bg-white border border-mist rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue/20"
                />
              </div>
            </div>
            <div>
              <label className="block font-mono text-[10px] text-silver uppercase tracking-wider mb-1">Personal message (optional)</label>
              <textarea
                value={newReqForm.personal_message}
                onChange={e => setNewReqForm(f => ({ ...f, personal_message: e.target.value }))}
                rows={2}
                placeholder="Appears in the email and on the form — personalize it."
                className="w-full text-sm text-ink bg-white border border-mist rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue/20 resize-none"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={async () => {
                  if (!newReqForm.slug || !newReqForm.requester_name) { showError('Slug and name are required'); return }
                  try {
                    const created = await api.testimonialRequests.create({
                      slug: newReqForm.slug,
                      requester_name: newReqForm.requester_name,
                      requester_email: newReqForm.requester_email || undefined,
                      requester_role: newReqForm.requester_role || undefined,
                      personal_message: newReqForm.personal_message || undefined,
                    })
                    setTestimonialReqs(prev => [created, ...prev])
                    setNewReqForm({ slug: '', requester_name: '', requester_email: '', requester_role: '', personal_message: '' })
                    setShowNewReqForm(false)
                    showToast('Request created')
                  } catch (err) { showError((err as Error).message) }
                }}
                className="px-4 py-2 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => setShowNewReqForm(false)}
                className="px-4 py-2 text-steel font-mono text-xs rounded-lg hover:bg-mist transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Request list */}
        <div className="space-y-2">
          {testimonialReqs.map(req => {
            const statusColors: Record<string, string> = {
              pending: 'bg-silver/10 text-silver',
              sent: 'bg-blue-wash text-blue',
              submitted: 'bg-amber-50 text-amber-600 border border-amber-200',
              approved: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
              rejected: 'bg-ember/10 text-ember',
            }
            const isExpanded = expandedReq === req.id
            return (
              <div key={req.id} className="rounded-xl border border-mist bg-white overflow-hidden">
                {/* Row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-ink">{req.requester_name}</span>
                      {req.requester_role && <span className="text-xs text-steel">{req.requester_role}</span>}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wide ${statusColors[req.status] ?? 'bg-mist text-steel'}`}>
                        {req.status}
                      </span>
                    </div>
                    <p className="text-xs text-silver font-mono mt-0.5">/go/{req.slug}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Copy link */}
                    <button
                      title="Copy link"
                      onClick={() => { navigator.clipboard.writeText(`https://nathanblatter.com/go/${req.slug}`); showToast('Link copied') }}
                      className="p-1.5 text-silver hover:text-blue transition-colors"
                    >
                      <Copy size={13} />
                    </button>

                    {/* Send / resend email */}
                    {req.requester_email && req.status !== 'approved' && req.status !== 'rejected' && (
                      <button
                        title={req.status === 'sent' ? 'Resend email' : 'Send email'}
                        onClick={async () => {
                          try {
                            await api.testimonialRequests.sendEmail(req.id)
                            setTestimonialReqs(prev => prev.map(r => r.id === req.id ? { ...r, status: r.status === 'pending' ? 'sent' : r.status } : r))
                            showToast('Email sent')
                          } catch (err) { showError((err as Error).message) }
                        }}
                        className="p-1.5 text-silver hover:text-blue transition-colors"
                      >
                        <ExternalLink size={13} />
                      </button>
                    )}

                    {/* Expand to see submission */}
                    {req.status === 'submitted' && (
                      <button
                        title="View submission"
                        onClick={() => setExpandedReq(isExpanded ? null : req.id)}
                        className="p-1.5 text-silver hover:text-blue transition-colors"
                      >
                        <Eye size={13} />
                      </button>
                    )}

                    {/* Approve */}
                    {req.status === 'submitted' && (
                      <button
                        title="Approve"
                        onClick={async () => {
                          try {
                            const updated = await api.testimonialRequests.approve(req.id)
                            setTestimonialReqs(prev => prev.map(r => r.id === req.id ? updated : r))
                            showToast('Approved — testimonial created')
                          } catch (err) { showError((err as Error).message) }
                        }}
                        className="p-1.5 text-silver hover:text-emerald-600 transition-colors"
                      >
                        <Check size={13} />
                      </button>
                    )}

                    {/* Reject */}
                    {['submitted', 'sent', 'pending'].includes(req.status) && (
                      <button
                        title="Reject"
                        onClick={async () => {
                          try {
                            const updated = await api.testimonialRequests.reject(req.id)
                            setTestimonialReqs(prev => prev.map(r => r.id === req.id ? updated : r))
                            showToast('Rejected')
                          } catch (err) { showError((err as Error).message) }
                        }}
                        className="p-1.5 text-silver hover:text-ember transition-colors"
                      >
                        <X size={13} />
                      </button>
                    )}

                    {/* Delete */}
                    <button
                      title="Delete"
                      onClick={async () => {
                        try {
                          await api.testimonialRequests.delete(req.id)
                          setTestimonialReqs(prev => prev.filter(r => r.id !== req.id))
                          showToast('Deleted')
                        } catch (err) { showError((err as Error).message) }
                      }}
                      className="p-1.5 text-silver hover:text-ember transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Expanded submission content */}
                {isExpanded && req.submitted_quote && (
                  <div className="px-4 pb-4 pt-1 border-t border-mist bg-snow space-y-2">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-medium text-ink">{req.submitted_name}</span>
                      {req.submitted_role && <span className="text-steel">{req.submitted_role}</span>}
                      {req.submitted_avatar_url && (
                        <img src={req.submitted_avatar_url} alt="" className="w-6 h-6 rounded-full object-cover border border-mist" />
                      )}
                    </div>
                    <blockquote className="text-sm text-ink/80 italic leading-relaxed pl-3 border-l-2 border-blue/30">
                      &ldquo;{req.submitted_quote}&rdquo;
                    </blockquote>
                  </div>
                )}
              </div>
            )
          })}
          {testimonialReqs.length === 0 && tReqsLoaded && (
            <p className="text-center text-steel text-sm py-4 font-mono">No requests yet. Create one above.</p>
          )}
          {!tReqsLoaded && (
            <p className="text-center text-steel text-sm py-4 font-mono">Loading…</p>
          )}
        </div>
      </SectionCard>
    </motion.div>
  )

  const renderCoursework = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-sans font-semibold text-ink mb-1">Coursework</h2>
          <p className="text-steel text-sm">{coursework.length} courses listed</p>
        </div>
        <button onClick={() => setAddingCourse(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors shadow-sm">
          <Plus size={14} /> Add Course
        </button>
      </div>

      {addingCourse && (
        <SectionCard>
          <div className="flex items-center gap-3">
            <input
              autoFocus
              value={newCourseName}
              onChange={e => setNewCourseName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCourse()}
              placeholder="Course name…"
              className="flex-1 px-3.5 py-2.5 bg-white border border-mist rounded-lg text-sm text-ink placeholder-silver focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all"
            />
            <button onClick={addCourse} className="px-4 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors">
              Add
            </button>
            <button onClick={() => { setAddingCourse(false); setNewCourseName('') }} className="px-4 py-2.5 bg-cloud text-steel font-mono text-xs rounded-lg hover:bg-mist transition-colors">
              Cancel
            </button>
          </div>
        </SectionCard>
      )}

      <SectionCard>
        <div className="flex flex-wrap gap-2.5">
          {coursework.map(course => (
            <span key={course.id} className="group inline-flex items-center gap-2 font-mono text-sm px-4 py-2.5 rounded-xl border border-mist bg-white text-ink hover:border-blue/30 transition-all">
              {course.name}
              <button onClick={() => deleteCourse(course.id)} className="text-silver hover:text-ember opacity-0 group-hover:opacity-100 transition-all">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      </SectionCard>
    </motion.div>
  )

  const renderContact = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div>
        <h2 className="text-2xl font-sans font-semibold text-ink mb-1">Contact Info</h2>
        <p className="text-steel text-sm">Social links and contact details shown on the Contact page.</p>
      </div>

      {/* Social links */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-sans font-semibold text-ink">Social Links</h3>
          <button onClick={addSocial} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-blue bg-blue-wash rounded-lg hover:bg-blue/10 transition-colors">
            <Plus size={12} /> Add
          </button>
        </div>

        <div className="space-y-3">
          {socials.map(social => (
            <SectionCard key={social.id} className="!p-0 overflow-hidden">
              <div
                className="flex items-center gap-4 p-5 cursor-pointer hover:bg-cloud/50 transition-colors"
                onClick={() => setEditingSocial(editingSocial === social.id ? null : social.id)}
              >
                <GripVertical size={14} className="text-silver" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-ink">{social.label}</span>
                  <p className="text-xs text-steel font-mono mt-0.5">{social.handle}</p>
                </div>
                <span className="font-mono text-xs text-silver truncate max-w-48 shrink-0">{social.href}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={e => { e.stopPropagation(); setEditingSocial(editingSocial === social.id ? null : social.id) }} className="p-1.5 text-steel hover:text-blue transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); deleteSocial(social.id) }} className="p-1.5 text-steel hover:text-ember transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {editingSocial === social.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-mist p-6 bg-white space-y-5">
                      <div className="grid grid-cols-2 gap-5">
                        <AdminInput label="Label" value={social.label} onChange={v => updateSocialLocal(social.id, 'label', v)} />
                        <AdminInput label="Icon name" value={social.icon} onChange={v => updateSocialLocal(social.id, 'icon', v)} mono placeholder="Github, Linkedin, Mail…" />
                      </div>
                      <div className="grid grid-cols-2 gap-5">
                        <AdminInput label="Handle / Display text" value={social.handle} onChange={v => updateSocialLocal(social.id, 'handle', v)} mono />
                        <AdminInput label="URL / href" value={social.href} onChange={v => updateSocialLocal(social.id, 'href', v)} mono placeholder="https://…" />
                      </div>
                      <div className="flex justify-end pt-2">
                        <button onClick={() => saveSocial(social)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors">
                          <Save size={13} /> Save Changes
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </SectionCard>
          ))}
        </div>
      </div>

      {/* Page meta */}
      {contactMeta && (
        <SectionCard>
          <h3 className="font-sans font-semibold text-ink mb-5">Page Meta</h3>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-5">
              <AdminInput label="Heading" value={contactMeta.heading} onChange={v => setContactMeta(prev => prev ? { ...prev, heading: v } : prev)} />
              <AdminInput label="Subheading" value={contactMeta.subheading} onChange={v => setContactMeta(prev => prev ? { ...prev, subheading: v } : prev)} />
            </div>
            <AdminTextarea label="Body Text" value={contactMeta.body_text} onChange={v => setContactMeta(prev => prev ? { ...prev, body_text: v } : prev)} rows={3} />
            <AdminInput label="Location Text" value={contactMeta.location_text} onChange={v => setContactMeta(prev => prev ? { ...prev, location_text: v } : prev)} />
          </div>
          <div className="flex justify-end pt-5">
            <button onClick={saveContactMeta} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors">
              <Save size={13} /> Save Meta
            </button>
          </div>
        </SectionCard>
      )}
    </motion.div>
  )

  const renderBlog = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-sans font-semibold text-ink mb-1">Blog</h2>
          <p className="text-steel text-sm">{blogs.length} post{blogs.length !== 1 ? 's' : ''} · {blogs.filter(b => b.published).length} published</p>
        </div>
        <button
          onClick={addBlog}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors shadow-sm"
        >
          <Plus size={14} /> New Post
        </button>
      </div>

      <div className="space-y-3">
        {blogs.length === 0 && (
          <SectionCard>
            <p className="text-center text-steel text-sm py-8 font-mono">No posts yet. Click "New Post" to get started.</p>
          </SectionCard>
        )}

        {blogs.map(post => (
          <SectionCard key={post.id} className="!p-0 overflow-hidden">
            {/* Row */}
            <div
              className="flex items-center gap-4 p-5 cursor-pointer hover:bg-cloud/50 transition-colors"
              onClick={() => editingBlog === post.id ? closeBlogEditor() : openBlogEditor(post)}
            >
              <FileText size={15} className="text-steel shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-ink block truncate">{post.title}</span>
                <p className="text-xs text-silver font-mono mt-0.5 truncate">/{post.slug}</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 ${
                post.published ? 'bg-teal/10 text-teal' : 'bg-silver/20 text-steel'
              }`}>
                {post.published ? <><Globe size={10} /> Published</> : <><EyeOff size={10} /> Draft</>}
              </span>
              {post.published_at && (
                <span className="font-mono text-[11px] text-silver shrink-0 hidden md:block">
                  {new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={e => { e.stopPropagation(); editingBlog === post.id ? closeBlogEditor() : openBlogEditor(post) }}
                  className="p-1.5 text-steel hover:text-blue transition-colors"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); deleteBlog(post.id) }}
                  className="p-1.5 text-steel hover:text-ember transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Editor */}
            <AnimatePresence>
              {editingBlog === post.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-mist p-6 bg-white space-y-5">
                    {/* Title + Subtitle */}
                    <div className="grid grid-cols-2 gap-5">
                      <AdminInput
                        label="Title"
                        value={blogDraft.title ?? ''}
                        onChange={v => updateBlogDraft('title', v)}
                      />
                      <AdminInput
                        label="Subtitle"
                        value={blogDraft.subtitle ?? ''}
                        onChange={v => updateBlogDraft('subtitle', v)}
                        placeholder="Optional tagline"
                      />
                    </div>

                    {/* Slug + Cover image */}
                    <div className="grid grid-cols-2 gap-5">
                      <AdminInput
                        label="Slug"
                        value={blogDraft.slug ?? ''}
                        onChange={v => updateBlogDraft('slug', v)}
                        mono
                        placeholder="url-friendly-slug"
                      />
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="font-mono text-[11px] text-steel tracking-wider uppercase">Cover Image</label>
                          <FileUploadButton
                            prefix="blog/covers"
                            accept="image/*"
                            label="Upload"
                            onUploaded={url => updateBlogDraft('cover_image_url', url)}
                          />
                        </div>
                        <input
                          value={blogDraft.cover_image_url ?? ''}
                          onChange={e => updateBlogDraft('cover_image_url', e.target.value)}
                          placeholder="URL or upload an image →"
                          className="w-full px-3.5 py-2.5 bg-white border border-mist rounded-lg text-sm text-ink placeholder-silver focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all"
                        />
                        {blogDraft.cover_image_url && (
                          <img src={blogDraft.cover_image_url} alt="Cover preview" className="mt-2 h-20 rounded-lg object-cover border border-mist" />
                        )}
                      </div>
                    </div>

                    {/* Excerpt */}
                    <AdminTextarea
                      label="Excerpt"
                      value={blogDraft.excerpt ?? ''}
                      onChange={v => updateBlogDraft('excerpt', v)}
                      rows={2}
                    />

                    {/* Tags */}
                    <TagEditor
                      tags={blogDraft.tags ?? []}
                      onChange={tags => updateBlogDraft('tags', tags)}
                    />

                    {/* Content with preview toggle */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="font-mono text-[11px] text-steel tracking-wider uppercase">
                          Content (Markdown)
                        </label>
                        <div className="flex items-center gap-3">
                          <FileUploadButton
                            prefix="blog/images"
                            accept="image/*"
                            label="Insert Image"
                            onUploaded={url => {
                              const md = `\n![image](${url})\n`
                              updateBlogDraft('content', (blogDraft.content ?? '') + md)
                            }}
                          />
                          <FileUploadButton
                            prefix="blog/files"
                            label="Insert File"
                            onUploaded={(url, key) => {
                              const name = key.split('/').pop() || 'file'
                              const md = `\n[${name}](${url})\n`
                              updateBlogDraft('content', (blogDraft.content ?? '') + md)
                            }}
                          />
                          <button
                            onClick={() => setShowBlogPreview(v => !v)}
                            className="inline-flex items-center gap-1.5 font-mono text-[10px] text-steel hover:text-blue transition-colors"
                          >
                            {showBlogPreview ? <><Pencil size={11} /> Edit</> : <><Eye size={11} /> Preview</>}
                          </button>
                        </div>
                      </div>

                      {showBlogPreview ? (
                        <div className="w-full min-h-[320px] max-h-[600px] px-5 py-4 bg-cloud border border-mist rounded-lg text-sm text-ink overflow-y-auto">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkFrontmatter]}
                            components={{
                              h1: ({ children }) => <h1 className="text-xl font-bold text-ink mt-6 mb-3">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-lg font-semibold text-ink mt-5 mb-2">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-base font-semibold text-ink mt-4 mb-1.5">{children}</h3>,
                              p: ({ children }) => <p className="text-ink/80 leading-7 mb-4">{children}</p>,
                              strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
                              a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue hover:underline underline-offset-2">{children}</a>,
                              ul: ({ children }) => <ul className="list-disc pl-5 mb-4 space-y-1 text-ink/80">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal pl-5 mb-4 space-y-1 text-ink/80">{children}</ol>,
                              li: ({ children }) => <li className="leading-7">{children}</li>,
                              blockquote: ({ children }) => <blockquote className="border-l-4 border-blue/30 pl-4 my-4 text-steel italic">{children}</blockquote>,
                              pre: ({ children }) => <pre className="bg-[#1a1a2e] text-[#e2e8f0] p-4 rounded-lg overflow-x-auto my-4 text-xs leading-relaxed font-mono">{children}</pre>,
                              code: ({ className, children, ...props }) => {
                                if (className?.startsWith('language-')) return <code className={className} {...props}>{children}</code>
                                return <code className="font-mono text-xs bg-white text-blue px-1.5 py-0.5 rounded" {...props}>{children}</code>
                              },
                              hr: () => <hr className="border-mist my-6" />,
                              img: ({ src, alt }) => <img src={src} alt={alt} className="w-full rounded-lg my-4 border border-mist" />,
                              table: ({ children }) => <div className="overflow-x-auto my-4 rounded-lg border border-mist"><table className="w-full text-sm border-collapse">{children}</table></div>,
                              thead: ({ children }) => <thead className="bg-white">{children}</thead>,
                              th: ({ children }) => <th className="border-b border-mist px-3 py-2 font-mono text-[10px] text-steel uppercase tracking-wider text-left">{children}</th>,
                              td: ({ children }) => <td className="border-b border-mist/60 px-3 py-2 text-ink/80">{children}</td>,
                            }}
                          >
                            {blogDraft.content ?? ''}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <textarea
                          value={blogDraft.content ?? ''}
                          onChange={e => updateBlogDraft('content', e.target.value)}
                          rows={18}
                          placeholder="# Your Post Title&#10;&#10;Write your content in Markdown…"
                          className="w-full px-3.5 py-2.5 bg-white border border-mist rounded-lg text-sm text-ink placeholder-silver focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all resize-none font-mono leading-relaxed"
                        />
                      )}
                    </div>

                    {/* Published toggle + Save */}
                    <div className="flex items-center justify-between pt-2">
                      <label className="flex items-center gap-3 cursor-pointer select-none">
                        <button
                          role="switch"
                          aria-checked={blogDraft.published ?? false}
                          onClick={() => updateBlogDraft('published', !(blogDraft.published ?? false))}
                          className={`relative w-11 h-6 rounded-full transition-colors ${
                            blogDraft.published ? 'bg-teal' : 'bg-mist'
                          }`}
                        >
                          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            blogDraft.published ? 'translate-x-6' : 'translate-x-1'
                          }`} />
                        </button>
                        <span className="text-sm text-ink font-medium">
                          {blogDraft.published ? 'Published' : 'Draft'}
                        </span>
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={closeBlogEditor}
                          className="px-4 py-2.5 bg-cloud text-steel font-mono text-xs rounded-lg hover:bg-mist transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveBlog}
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors"
                        >
                          <Save size={13} /> Save Post
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </SectionCard>
        ))}
      </div>
    </motion.div>
  )

  /* ═══════════════════════════════════════════════
     FILES / STORAGE
     ═══════════════════════════════════════════════ */

  const refreshFiles = async (prefix = filesPrefix) => {
    try {
      const res = await api.storage.list(prefix)
      setFiles(res.files)
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const deleteFile = async (key: string) => {
    try {
      await api.storage.delete(key)
      setFiles(prev => prev.filter(f => f.key !== key))
      showToast('File deleted')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showToast('Copied to clipboard')
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const isImageKey = (key: string) => /\.(jpg|jpeg|png|gif|webp|svg|avif)$/i.test(key)

  const renderFiles = () => {
    const prefixes = [...new Set(files.map(f => f.key.split('/').slice(0, -1).join('/')))]
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-sans font-semibold text-ink mb-1">Files</h2>
            <p className="text-steel text-sm">{files.length} file{files.length !== 1 ? 's' : ''} in storage</p>
          </div>
          <FileUploadButton
            prefix="uploads"
            label="Upload File"
            className="!px-4 !py-2.5 !bg-blue !text-white hover:!bg-blue-dim !font-semibold"
            onUploaded={() => refreshFiles()}
          />
        </div>

        {/* Folder filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setFilesPrefix(''); setFilesLoaded(false) }}
            className={`font-mono text-[11px] px-3 py-1.5 rounded-full transition-all ${!filesPrefix ? 'bg-blue-wash text-blue' : 'bg-cloud text-steel hover:text-ink'}`}
          >
            All
          </button>
          {prefixes.map(p => (
            <button
              key={p}
              onClick={() => { setFilesPrefix(p); setFilesLoaded(false) }}
              className={`font-mono text-[11px] px-3 py-1.5 rounded-full transition-all ${filesPrefix === p ? 'bg-blue-wash text-blue' : 'bg-cloud text-steel hover:text-ink'}`}
            >
              {p || 'root'}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {files.length === 0 && (
            <SectionCard>
              <p className="text-center text-steel text-sm py-8 font-mono">No files uploaded yet.</p>
            </SectionCard>
          )}
          {files.map(file => {
            const url = api.storage.downloadUrl(file.key)
            const fileName = file.key.split('/').pop() || file.key
            const folder = file.key.split('/').slice(0, -1).join('/')
            return (
              <SectionCard key={file.key} className="!p-4">
                <div className="flex items-center gap-4">
                  {/* Thumbnail or icon */}
                  {isImageKey(file.key) ? (
                    <img src={url} alt={fileName} className="w-12 h-12 rounded-lg object-cover border border-mist shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-cloud border border-mist flex items-center justify-center shrink-0">
                      <File size={18} className="text-steel" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-ink block truncate">{fileName}</span>
                    <div className="flex items-center gap-3 mt-0.5">
                      {folder && <span className="font-mono text-[10px] text-silver">{folder}/</span>}
                      <span className="font-mono text-[10px] text-silver">{formatFileSize(file.size)}</span>
                      <span className="font-mono text-[10px] text-silver">
                        {new Date(file.last_modified).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => copyToClipboard(url)}
                      className="p-2 text-steel hover:text-blue transition-colors"
                      title="Copy URL"
                    >
                      <Copy size={13} />
                    </button>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-steel hover:text-blue transition-colors"
                      title="Download"
                    >
                      <Download size={13} />
                    </a>
                    <button
                      onClick={() => deleteFile(file.key)}
                      className="p-2 text-steel hover:text-ember transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </SectionCard>
            )
          })}
        </div>
      </motion.div>
    )
  }

  /* ═══════════════════════════════════════════════
     TRACKED LINKS
     ═══════════════════════════════════════════════ */

  const addLink = async () => {
    try {
      const created = await api.links.create({ slug: `link-${Date.now()}`, destination_url: 'https://', label: 'New Link' })
      setTrackedLinks(prev => [created, ...prev])
      showToast('Link created')
    } catch (err) { showError((err as Error).message) }
  }

  const saveLink = async (link: TrackedLinkResponse) => {
    try {
      await api.links.update(link.id, {
        slug: link.slug,
        destination_url: link.destination_url,
        label: link.label,
        portfolio_ctx: link.portfolio_ctx,
      })
      showToast('Link saved')
    } catch (err) { showError((err as Error).message) }
  }

  const removeLink = async (id: number) => {
    try {
      await api.links.delete(id)
      setTrackedLinks(prev => prev.filter(l => l.id !== id))
      showToast('Link deleted')
    } catch (err) { showError((err as Error).message) }
  }

  const renderLinks = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-sans font-semibold text-ink mb-1">Tracked Links</h2>
          <p className="text-steel text-sm">{trackedLinks.length} link{trackedLinks.length !== 1 ? 's' : ''} · Track clicks via Umami</p>
        </div>
        <button onClick={addLink} className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors shadow-sm">
          <Plus size={14} /> New Link
        </button>
      </div>

      <SectionCard className="!p-0 overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-0 text-[11px] font-mono text-steel tracking-wider uppercase px-6 py-3 border-b border-mist bg-cloud/50">
          <span>Label / Slug</span>
          <span>Destination</span>
          <span className="w-16 text-center">Clicks</span>
          <span className="w-8"></span>
          <span className="w-8"></span>
          <span className="w-8"></span>
        </div>
        {trackedLinks.length === 0 && (
          <p className="text-center text-steel text-sm py-8 font-mono">No links yet.</p>
        )}
        {trackedLinks.map(link => (
          <div key={link.id}>
            <div className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-0 items-center px-6 py-3.5 border-b border-mist last:border-b-0 hover:bg-cloud/30 transition-colors">
              <div>
                <input
                  value={link.label}
                  onChange={e => setTrackedLinks(prev => prev.map(l => l.id === link.id ? { ...l, label: e.target.value } : l))}
                  className="text-sm text-ink font-medium bg-transparent focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue/10 rounded px-2 py-1 -ml-2 transition-all w-full"
                  placeholder="Label"
                />
                <div className="flex items-center gap-1 ml-0">
                  <span className="font-mono text-[10px] text-silver">/go/</span>
                  <input
                    value={link.slug}
                    onChange={e => setTrackedLinks(prev => prev.map(l => l.id === link.id ? { ...l, slug: e.target.value } : l))}
                    className="font-mono text-[11px] text-steel bg-transparent focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue/10 rounded px-1 py-0.5 transition-all"
                    placeholder="slug"
                  />
                  <button
                    onClick={() => { navigator.clipboard.writeText(`https://nathanblatter.com/go/${link.slug}`); showToast('Copied') }}
                    className="p-1 text-silver hover:text-blue transition-colors"
                  >
                    <Copy size={10} />
                  </button>
                </div>
              </div>
              <input
                value={link.destination_url}
                onChange={e => setTrackedLinks(prev => prev.map(l => l.id === link.id ? { ...l, destination_url: e.target.value } : l))}
                className="font-mono text-xs text-steel bg-transparent focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue/10 rounded px-2 py-1 transition-all truncate"
                placeholder="https://..."
              />
              <span className="w-16 text-center font-mono text-sm font-semibold text-ink">{link.clicks}</span>
              <button
                onClick={() => setExpandedCtx(expandedCtx === link.id ? null : link.id)}
                className={`p-1.5 transition-colors ${link.portfolio_ctx ? 'text-blue' : 'text-steel hover:text-blue'}`}
                title="Customize portfolio view"
              >
                <Settings size={13} />
              </button>
              <button onClick={() => saveLink(link)} className="p-1.5 text-steel hover:text-blue transition-colors">
                <Save size={13} />
              </button>
              <button onClick={() => removeLink(link.id)} className="p-1.5 text-steel hover:text-ember transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
            {expandedCtx === link.id && (() => {
              const patchCtx = (patch: Partial<NonNullable<TrackedLinkResponse['portfolio_ctx']>>) => {
                setTrackedLinks(prev => prev.map(l => l.id !== link.id ? l : {
                  ...l,
                  portfolio_ctx: { projects: {}, skills: {}, experience: {}, interests: {}, testimonials: {}, ...(l.portfolio_ctx ?? {}), ...patch },
                }))
              }
              const patchAbout = (patch: Record<string, unknown>) => {
                setTrackedLinks(prev => prev.map(l => l.id !== link.id ? l : {
                  ...l,
                  portfolio_ctx: {
                    projects: {}, skills: {}, experience: {}, interests: {}, testimonials: {},
                    ...(l.portfolio_ctx ?? {}),
                    about: { ...(l.portfolio_ctx?.about ?? {}), ...patch },
                  },
                }))
              }
              const tabs = ['hero', 'projects', 'skills', 'journey', 'about', 'interests', 'testimonials']
              return (
                <div className="border-b border-mist bg-cloud/20">
                  {/* Tab bar */}
                  <div className="flex gap-0.5 px-6 pt-4 pb-0 border-b border-mist">
                    {tabs.map(tab => (
                      <button
                        key={tab}
                        onClick={() => setCtxTab(tab)}
                        className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider rounded-t transition-colors ${ctxTab === tab ? 'bg-white border border-b-white border-mist text-blue -mb-px' : 'text-steel hover:text-ink'}`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  <div className="px-6 py-5 space-y-4">
                    {/* ── Hero ── */}
                    {ctxTab === 'hero' && (
                      <div className="grid grid-cols-2 gap-4">
                        <AdminInput label="Company Name" value={link.portfolio_ctx?.company ?? ''} placeholder="Stripe"
                          onChange={v => patchCtx({ company: v || undefined })} />
                        <AdminInput label="Hero Tagline" value={link.portfolio_ctx?.tagline ?? ''} placeholder="Custom subtitle for this company…"
                          onChange={v => patchCtx({ tagline: v || undefined })} />
                      </div>
                    )}

                    {/* ── Projects ── */}
                    {ctxTab === 'projects' && (
                      <div className="space-y-1">
                        {projects.map(p => (
                          <div key={p.project_id} className="flex items-center justify-between py-2 border-b border-mist/50 last:border-0">
                            <div>
                              <span className="text-sm text-ink">{p.title}</span>
                              <span className="ml-2 font-mono text-[10px] text-silver">{p.year}</span>
                            </div>
                            <VisibilityToggle
                              value={link.portfolio_ctx?.projects?.[p.project_id]?.visibility ?? 'show'}
                              onChange={v => patchCtx({ projects: { ...(link.portfolio_ctx?.projects ?? {}), [p.project_id]: { visibility: v as 'show' | 'highlight' | 'hide' } } })}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ── Skills ── */}
                    {ctxTab === 'skills' && (
                      <div className="space-y-1">
                        {skills.map(s => (
                          <div key={s.id} className="flex items-center justify-between py-2 border-b border-mist/50 last:border-0">
                            <div>
                              <span className="text-sm text-ink">{s.name}</span>
                              <span className="ml-2 font-mono text-[10px] text-silver">{s.category}</span>
                            </div>
                            <VisibilityToggle
                              value={link.portfolio_ctx?.skills?.[String(s.id)]?.visibility ?? 'show'}
                              onChange={v => patchCtx({ skills: { ...(link.portfolio_ctx?.skills ?? {}), [String(s.id)]: { visibility: v as 'show' | 'highlight' | 'hide' } } })}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ── Journey ── */}
                    {ctxTab === 'journey' && (
                      <div className="space-y-3">
                        {experience.map(item => {
                          const expCtx = link.portfolio_ctx?.experience?.[String(item.id)]
                          return (
                            <div key={item.id} className="border border-mist rounded-xl p-4 bg-white space-y-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="text-sm font-medium text-ink">{item.title}</span>
                                  <span className="ml-2 font-mono text-[10px] text-steel">{item.year}</span>
                                </div>
                                <VisibilityToggle
                                  value={expCtx?.visibility ?? 'show'}
                                  onChange={v => patchCtx({ experience: { ...(link.portfolio_ctx?.experience ?? {}), [String(item.id)]: { ...(expCtx ?? {}), visibility: v as 'show' | 'highlight' | 'hide' } } })}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <AdminInput label="Title override" value={expCtx?.title ?? ''} placeholder={item.title}
                                  onChange={v => patchCtx({ experience: { ...(link.portfolio_ctx?.experience ?? {}), [String(item.id)]: { ...(expCtx ?? { visibility: 'show' as const }), title: v || undefined } } })} />
                                <AdminInput label="Subtitle override" value={expCtx?.subtitle ?? ''} placeholder={item.subtitle}
                                  onChange={v => patchCtx({ experience: { ...(link.portfolio_ctx?.experience ?? {}), [String(item.id)]: { ...(expCtx ?? { visibility: 'show' as const }), subtitle: v || undefined } } })} />
                              </div>
                              <AdminTextarea label="Description override" value={expCtx?.description ?? ''} rows={2}
                                onChange={v => patchCtx({ experience: { ...(link.portfolio_ctx?.experience ?? {}), [String(item.id)]: { ...(expCtx ?? { visibility: 'show' as const }), description: v || undefined } } })} />
                              <AdminTextarea label="Additional note (shown below description)" value={expCtx?.note ?? ''} rows={2}
                                onChange={v => patchCtx({ experience: { ...(link.portfolio_ctx?.experience ?? {}), [String(item.id)]: { ...(expCtx ?? { visibility: 'show' as const }), note: v || undefined } } })} />
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* ── About ── */}
                    {ctxTab === 'about' && (
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <label className="block font-mono text-[11px] text-steel tracking-wider uppercase">Bio Paragraphs</label>
                          {[0, 1, 2].map(i => (
                            <AdminTextarea key={i} label={`Paragraph ${i + 1}`} rows={3}
                              value={link.portfolio_ctx?.about?.bio_paragraphs?.[i] ?? ''}
                              onChange={v => {
                                const cur = link.portfolio_ctx?.about?.bio_paragraphs ?? ['', '', '']
                                const next = [...cur] as string[]
                                while (next.length < 3) next.push('')
                                next[i] = v
                                patchAbout({ bio_paragraphs: next.every(s => !s) ? undefined : next })
                              }}
                            />
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <AdminInput label="Status Text" value={link.portfolio_ctx?.about?.status_text ?? ''} placeholder="Open to opportunities"
                            onChange={v => patchAbout({ status_text: v || undefined })} />
                          <AdminInput label="GPA Override" value={link.portfolio_ctx?.about?.gpa ?? ''} placeholder="3.95"
                            onChange={v => patchAbout({ gpa: v || undefined })} />
                        </div>
                        <AdminInput label="Headshot URL override" value={link.portfolio_ctx?.about?.headshot_url ?? ''} placeholder="https://…"
                          onChange={v => patchAbout({ headshot_url: v || undefined })} />

                        {/* Looking For */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="font-mono text-[11px] text-steel tracking-wider uppercase">What I'm Looking For</label>
                            {!link.portfolio_ctx?.about?.looking_for ? (
                              <button onClick={() => patchAbout({ looking_for: (about?.looking_for ?? []).map(x => ({ ...x })) })}
                                className="font-mono text-[10px] text-blue hover:underline">Copy from default</button>
                            ) : (
                              <button onClick={() => patchAbout({ looking_for: undefined })}
                                className="font-mono text-[10px] text-steel hover:text-ember">Use default</button>
                            )}
                          </div>
                          {link.portfolio_ctx?.about?.looking_for ? (
                            <div className="space-y-2">
                              {link.portfolio_ctx.about.looking_for.map((item, i) => (
                                <div key={i} className="border border-mist rounded-lg p-3 bg-white space-y-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <AdminInput label="Role" value={item.role ?? ''} onChange={v => {
                                      const arr = [...link.portfolio_ctx!.about!.looking_for!]
                                      arr[i] = { ...arr[i], role: v }
                                      patchAbout({ looking_for: arr })
                                    }} />
                                    <AdminInput label="Location" value={item.location ?? ''} onChange={v => {
                                      const arr = [...link.portfolio_ctx!.about!.looking_for!]
                                      arr[i] = { ...arr[i], location: v }
                                      patchAbout({ looking_for: arr })
                                    }} />
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <AdminInput label="Timeline" value={item.timeline ?? ''} onChange={v => {
                                      const arr = [...link.portfolio_ctx!.about!.looking_for!]
                                      arr[i] = { ...arr[i], timeline: v }
                                      patchAbout({ looking_for: arr })
                                    }} />
                                    <div className="flex items-end gap-2">
                                      <div className="flex-1">
                                        <AdminInput label="Detail" value={item.detail ?? ''} onChange={v => {
                                          const arr = [...link.portfolio_ctx!.about!.looking_for!]
                                          arr[i] = { ...arr[i], detail: v }
                                          patchAbout({ looking_for: arr })
                                        }} />
                                      </div>
                                      <button onClick={() => patchAbout({ looking_for: link.portfolio_ctx!.about!.looking_for!.filter((_, j) => j !== i) })}
                                        className="pb-2 text-steel hover:text-ember transition-colors"><Trash2 size={13} /></button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              <button onClick={() => patchAbout({ looking_for: [...(link.portfolio_ctx?.about?.looking_for ?? []), { role: '', location: '', timeline: '', detail: '' }] })}
                                className="font-mono text-[11px] text-steel hover:text-blue transition-colors">+ Add item</button>
                            </div>
                          ) : (
                            <p className="font-mono text-[11px] text-silver">Using default values</p>
                          )}
                        </div>

                        {/* Info Fields */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="font-mono text-[11px] text-steel tracking-wider uppercase">Info Fields</label>
                            {!link.portfolio_ctx?.about?.info_fields ? (
                              <button onClick={() => patchAbout({ info_fields: (about?.info_fields ?? []).map(x => ({ ...x })) })}
                                className="font-mono text-[10px] text-blue hover:underline">Copy from default</button>
                            ) : (
                              <button onClick={() => patchAbout({ info_fields: undefined })}
                                className="font-mono text-[10px] text-steel hover:text-ember">Use default</button>
                            )}
                          </div>
                          {link.portfolio_ctx?.about?.info_fields ? (
                            <div className="space-y-2">
                              {link.portfolio_ctx.about.info_fields.map((field, i) => (
                                <div key={i} className="flex items-end gap-2">
                                  <div className="flex-1"><AdminInput label="Label" value={field.label ?? ''} onChange={v => {
                                    const arr = [...link.portfolio_ctx!.about!.info_fields!]
                                    arr[i] = { ...arr[i], label: v }
                                    patchAbout({ info_fields: arr })
                                  }} /></div>
                                  <div className="flex-1"><AdminInput label="Value" value={field.value ?? ''} onChange={v => {
                                    const arr = [...link.portfolio_ctx!.about!.info_fields!]
                                    arr[i] = { ...arr[i], value: v }
                                    patchAbout({ info_fields: arr })
                                  }} /></div>
                                  <button onClick={() => patchAbout({ info_fields: link.portfolio_ctx!.about!.info_fields!.filter((_, j) => j !== i) })}
                                    className="pb-2 text-steel hover:text-ember transition-colors"><Trash2 size={13} /></button>
                                </div>
                              ))}
                              <button onClick={() => patchAbout({ info_fields: [...(link.portfolio_ctx?.about?.info_fields ?? []), { label: '', value: '' }] })}
                                className="font-mono text-[11px] text-steel hover:text-blue transition-colors">+ Add field</button>
                            </div>
                          ) : (
                            <p className="font-mono text-[11px] text-silver">Using default values</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ── Interests ── */}
                    {ctxTab === 'interests' && (
                      <div className="space-y-1">
                        {interests.map(item => (
                          <div key={item.id} className="flex items-center justify-between py-2 border-b border-mist/50 last:border-0">
                            <span className="text-sm text-ink">{item.label}</span>
                            <VisibilityToggle
                              value={link.portfolio_ctx?.interests?.[String(item.id)]?.visibility ?? 'show'}
                              onChange={v => patchCtx({ interests: { ...(link.portfolio_ctx?.interests ?? {}), [String(item.id)]: { visibility: v as 'show' | 'highlight' | 'hide' } } })}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ── Testimonials ── */}
                    {ctxTab === 'testimonials' && (
                      <div className="space-y-1">
                        {testimonials.map(t => (
                          <div key={t.id} className="flex items-center justify-between py-2 border-b border-mist/50 last:border-0">
                            <div>
                              <span className="text-sm text-ink">{t.name}</span>
                              <span className="ml-2 font-mono text-[10px] text-silver">{t.role}</span>
                            </div>
                            <VisibilityToggle
                              value={link.portfolio_ctx?.testimonials?.[String(t.id)]?.visibility ?? 'show'}
                              onChange={v => patchCtx({ testimonials: { ...(link.portfolio_ctx?.testimonials ?? {}), [String(t.id)]: { visibility: v as 'show' | 'highlight' | 'hide' } } })}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-mist">
                      <button onClick={() => setTrackedLinks(prev => prev.map(l => l.id === link.id ? { ...l, portfolio_ctx: null } : l))}
                        className="font-mono text-[11px] text-steel hover:text-ember transition-colors">
                        Clear all customization
                      </button>
                      <span className="font-mono text-[10px] text-silver">Save using the row save button →</span>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        ))}
      </SectionCard>
    </motion.div>
  )

  /* ═══════════════════════════════════════════════
     INTERNSHIP TRACKER
     ═══════════════════════════════════════════════ */

  const STATUS_PIPELINE: { key: string; label: string; color: string }[] = [
    { key: 'wishlist', label: 'Wishlist', color: '#c8d0db' },
    { key: 'drafting', label: 'Drafting', color: '#8c95a6' },
    { key: 'applied', label: 'Applied', color: '#3b6cf5' },
    { key: 'online_assessment', label: 'OA', color: '#7c5cf5' },
    { key: 'recruiter_screen', label: 'Recruiter', color: '#38b2ac' },
    { key: 'phone_screen', label: 'Phone', color: '#38b2ac' },
    { key: 'technical', label: 'Technical', color: '#2a54d4' },
    { key: 'onsite', label: 'Onsite', color: '#1a1f2e' },
    { key: 'final_round', label: 'Final', color: '#5b8af7' },
    { key: 'offer', label: 'Offer', color: '#38b2ac' },
    { key: 'accepted', label: 'Accepted', color: '#22c55e' },
    { key: 'declined', label: 'Declined', color: '#f59e0b' },
    { key: 'rejected', label: 'Rejected', color: '#e25555' },
    { key: 'withdrawn', label: 'Withdrawn', color: '#8c95a6' },
    { key: 'ghosted', label: 'Ghosted', color: '#c8d0db' },
  ]

  const PRIORITY_COLORS: Record<string, string> = {
    dream: 'bg-violet/15 text-violet border-violet/30',
    high: 'bg-blue/10 text-blue border-blue/30',
    medium: 'bg-teal/10 text-teal border-teal/30',
    low: 'bg-steel/10 text-steel border-steel/30',
    backup: 'bg-silver/20 text-steel border-silver/40',
  }

  const addApplication = async (form: Record<string, string>) => {
    try {
      await api.internships.applications.create({
        company_name: form.company_name,
        job_title: form.job_title,
        team: form.team || undefined,
        role_type: form.role_type || 'internship',
        work_arrangement: form.work_arrangement || undefined,
        location_city: form.location_city || undefined,
        posting_url: form.posting_url || undefined,
        current_status: form.current_status || 'wishlist',
        priority: form.priority || 'medium',
        source: form.source || undefined,
        applied_on: form.applied_on || undefined,
        next_action: form.next_action || undefined,
        next_action_due: form.next_action_due || undefined,
        personal_notes: form.personal_notes || undefined,
      })
      await refreshInternships()
      setIntForm({
        company_name: '', job_title: '', team: '', role_type: 'internship',
        work_arrangement: '', location_city: '', posting_url: '',
        current_status: 'wishlist', priority: 'medium', source: '',
        applied_on: '', next_action: '', next_action_due: '', personal_notes: '',
      })
      setIntView('pipeline')
      showToast('Application added')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const updateAppStatus = async (appId: string, newStatus: string) => {
    try {
      await api.internships.applications.addStatus(appId, { status: newStatus })
      await refreshInternships()
      showToast(`Status updated to ${newStatus}`)
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const deleteApplication = async (appId: string) => {
    try {
      await api.internships.applications.delete(appId)
      await refreshInternships()
      showToast('Application archived')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const renderInternships = () => {
    if (!intLoaded) {
      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center py-32">
          <Loader2 size={24} className="animate-spin text-blue" />
        </motion.div>
      )
    }

    const dash = intDashboard

    const renderIntDashboard = () => (
      <div className="space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-5">
          {[
            { label: 'Total Apps', value: dash?.total_applications ?? 0, sub: `${dash?.response_rate ? (dash.response_rate * 100).toFixed(0) : 0}% response rate`, color: 'blue' },
            { label: 'Active', value: intApps.filter(a => !['rejected', 'withdrawn', 'ghosted', 'accepted', 'declined'].includes(a.current_status)).length, sub: 'in pipeline', color: 'teal' },
            { label: 'Offers', value: dash?.status_counts?.offer ?? 0, sub: `${dash?.offer_rate ? (dash.offer_rate * 100).toFixed(0) : 0}% offer rate`, color: 'violet' },
            { label: 'Interviews', value: intApps.filter(a => ['technical', 'onsite', 'final_round', 'phone_screen', 'recruiter_screen', 'online_assessment'].includes(a.current_status)).length, sub: 'scheduled / done', color: 'ember' },
          ].map(card => (
            <SectionCard key={card.label}>
              <div className="flex items-start justify-between mb-3">
                <span className="font-mono text-[11px] text-steel tracking-wider uppercase">{card.label}</span>
                <span className={`w-2 h-2 rounded-full bg-${card.color} mt-1`} />
              </div>
              <p className="text-3xl font-sans font-bold text-ink">{card.value}</p>
              <p className="text-xs text-steel mt-1 font-mono">{card.sub}</p>
            </SectionCard>
          ))}
        </div>

        {/* Pipeline Funnel Visualization */}
        <SectionCard>
          <h3 className="font-sans font-semibold text-ink mb-6 flex items-center gap-2">
            <TrendingUp size={16} className="text-blue" /> Pipeline Funnel
          </h3>
          <div className="space-y-2">
            {STATUS_PIPELINE.filter(s => (dash?.status_counts?.[s.key] ?? 0) > 0 || ['wishlist', 'applied', 'technical', 'offer', 'accepted', 'rejected'].includes(s.key)).map(stage => {
              const count = dash?.status_counts?.[stage.key] ?? 0
              const max = Math.max(...Object.values(dash?.status_counts ?? { a: 1 }), 1)
              const pct = (count / max) * 100
              return (
                <div key={stage.key} className="flex items-center gap-3 group">
                  <span className="font-mono text-[11px] text-steel w-20 text-right shrink-0">{stage.label}</span>
                  <div className="flex-1 h-8 bg-cloud rounded-lg overflow-hidden relative">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(pct, count > 0 ? 3 : 0)}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className="h-full rounded-lg relative"
                      style={{ backgroundColor: stage.color }}
                    />
                    {count > 0 && (
                      <span className="absolute inset-y-0 left-3 flex items-center font-mono text-xs font-bold text-white mix-blend-difference">
                        {count}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </SectionCard>

        {/* Two columns: Sources + Priority */}
        <div className="grid grid-cols-2 gap-6">
          <SectionCard>
            <h3 className="font-sans font-semibold text-ink mb-4 flex items-center gap-2">
              <Globe size={16} className="text-blue" /> Application Sources
            </h3>
            <div className="space-y-3">
              {Object.entries(dash?.source_counts ?? {}).sort(([, a], [, b]) => b - a).slice(0, 6).map(([source, count]) => (
                <div key={source} className="flex items-center justify-between">
                  <span className="text-sm text-ink capitalize">{source.replace(/_/g, ' ')}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-2 bg-cloud rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-dim to-blue-light" style={{ width: `${(count / Math.max(...Object.values(dash?.source_counts ?? { a: 1 }), 1)) * 100}%` }} />
                    </div>
                    <span className="font-mono text-[11px] text-steel w-6 text-right">{count}</span>
                  </div>
                </div>
              ))}
              {Object.keys(dash?.source_counts ?? {}).length === 0 && (
                <p className="text-sm text-steel italic">No applications yet</p>
              )}
            </div>
          </SectionCard>

          <SectionCard>
            <h3 className="font-sans font-semibold text-ink mb-4 flex items-center gap-2">
              <Target size={16} className="text-violet" /> By Priority
            </h3>
            <div className="space-y-3">
              {['dream', 'high', 'medium', 'low', 'backup'].map(p => {
                const count = dash?.priority_counts?.[p] ?? 0
                return (
                  <div key={p} className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] px-2.5 py-1 rounded-full border capitalize ${PRIORITY_COLORS[p]}`}>
                      {p}
                    </span>
                    <span className="font-mono text-sm font-bold text-ink">{count}</span>
                  </div>
                )
              })}
            </div>
          </SectionCard>
        </div>

        {/* Upcoming Actions */}
        {(dash?.upcoming_actions?.length ?? 0) > 0 && (
          <SectionCard>
            <h3 className="font-sans font-semibold text-ink mb-4 flex items-center gap-2">
              <Clock size={16} className="text-ember" /> Upcoming Actions
            </h3>
            <div className="space-y-2">
              {dash!.upcoming_actions.map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-white border border-mist">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Building2 size={14} className="text-steel shrink-0" />
                    <div className="min-w-0">
                      <span className="text-sm text-ink font-medium block truncate">{a.company_name} — {a.job_title}</span>
                      <span className="text-xs text-steel">{a.next_action}</span>
                    </div>
                  </div>
                  <span className="font-mono text-[11px] text-ember shrink-0 ml-3">{a.next_action_due}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    )

    const PIPELINE_STAGES = ['wishlist', 'applied', 'online_assessment', 'recruiter_screen', 'phone_screen', 'technical', 'onsite', 'final_round', 'offer']
    const TERMINAL_STAGES = ['accepted', 'declined', 'rejected', 'withdrawn', 'ghosted']

    const renderPipeline = () => {
      const allStages = [...PIPELINE_STAGES, ...TERMINAL_STAGES]
      const stageApps = allStages
        .map(stage => ({
          stage,
          label: STATUS_PIPELINE.find(s => s.key === stage)?.label ?? stage,
          color: STATUS_PIPELINE.find(s => s.key === stage)?.color ?? '#999',
          apps: intApps.filter(a => a.current_status === stage),
          isTerminal: TERMINAL_STAGES.includes(stage),
        }))
        .filter(s => s.apps.length > 0)

      return (
        <div className="space-y-3">
          {stageApps.map(group => (
            <div key={group.stage}>
              {/* Stage header */}
              <div className="flex items-center gap-2.5 mb-2 px-1">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                <span className="font-mono text-[11px] text-steel tracking-wider uppercase">{group.label}</span>
                <div className="flex-1 h-px bg-mist" />
                <span className="font-mono text-[11px] text-silver">{group.apps.length}</span>
              </div>

              {/* Cards in this stage */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {group.apps.map(app => (
                  <motion.div
                    key={app.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`bg-white border border-mist rounded-lg p-3.5 cursor-pointer hover:border-blue/30 hover:shadow-sm transition-all ${group.isTerminal ? 'opacity-60' : ''}`}
                    onClick={() => setIntEditing(intEditing === app.id ? null : app.id)}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className="text-sm font-medium text-ink leading-tight">{app.company_name}</span>
                      <span className={`inline-flex items-center font-mono text-[9px] px-1.5 py-0.5 rounded-full border shrink-0 ml-2 ${PRIORITY_COLORS[app.priority]}`}>
                        {app.priority}
                      </span>
                    </div>
                    <p className="text-xs text-steel truncate">{app.job_title}</p>
                    <div className="flex items-center gap-3 mt-2">
                      {app.location_city && (
                        <span className="text-[10px] text-silver flex items-center gap-1"><MapPin size={9} />{app.location_city}</span>
                      )}
                      {app.next_action_due && (
                        <span className="text-[10px] text-ember font-mono flex items-center gap-1"><Clock size={9} />{app.next_action_due}</span>
                      )}
                    </div>
                    {app.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {app.tags.slice(0, 3).map(t => (
                          <span key={t.id} className="text-[9px] font-mono px-1.5 py-0.5 rounded-full" style={{ backgroundColor: (t.color || '#e4e9f0') + '20', color: t.color || '#8c95a6' }}>
                            {t.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          ))}

          {stageApps.length === 0 && (
            <div className="text-center py-16">
              <Target size={32} className="mx-auto text-silver mb-3" />
              <p className="text-steel text-sm">No applications yet</p>
            </div>
          )}
        </div>
      )
    }

    const renderList = () => (
      <div className="space-y-2">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_1fr_100px_80px_90px_100px_40px] gap-3 px-4 py-2">
          {['Company', 'Position', 'Status', 'Priority', 'Source', 'Applied', ''].map(h => (
            <span key={h} className="font-mono text-[10px] text-steel tracking-wider uppercase">{h}</span>
          ))}
        </div>
        {intApps.map(app => {
          const stageInfo = STATUS_PIPELINE.find(s => s.key === app.current_status)
          return (
            <div key={app.id}>
              <div
                className="grid grid-cols-[1fr_1fr_100px_80px_90px_100px_40px] gap-3 items-center px-4 py-3 bg-white border border-mist rounded-lg cursor-pointer hover:border-blue/30 transition-all"
                onClick={() => setIntEditing(intEditing === app.id ? null : app.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 size={13} className="text-steel shrink-0" />
                  <span className="text-sm text-ink font-medium truncate">{app.company_name}</span>
                </div>
                <span className="text-sm text-slate truncate">{app.job_title}</span>
                <span className="inline-flex items-center gap-1.5 font-mono text-[10px] px-2 py-1 rounded-full" style={{ backgroundColor: (stageInfo?.color ?? '#999') + '18', color: stageInfo?.color }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stageInfo?.color }} />
                  {stageInfo?.label}
                </span>
                <span className={`inline-flex items-center font-mono text-[10px] px-2 py-1 rounded-full border ${PRIORITY_COLORS[app.priority]}`}>
                  {app.priority}
                </span>
                <span className="font-mono text-[11px] text-steel capitalize">{app.source?.replace(/_/g, ' ') ?? '—'}</span>
                <span className="font-mono text-[11px] text-steel">{app.applied_on ?? '—'}</span>
                <button
                  onClick={e => { e.stopPropagation(); deleteApplication(app.id) }}
                  className="p-1.5 text-silver hover:text-ember transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {/* Expanded detail panel */}
              <AnimatePresence>
                {intEditing === app.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-snow border border-t-0 border-mist rounded-b-lg p-5 space-y-4">
                      {/* Status changer */}
                      <div>
                        <label className="block font-mono text-[11px] text-steel mb-2 tracking-wider uppercase">Change Status</label>
                        <div className="flex flex-wrap gap-1.5">
                          {STATUS_PIPELINE.map(s => (
                            <button
                              key={s.key}
                              onClick={() => updateAppStatus(app.id, s.key)}
                              className={`font-mono text-[10px] px-2.5 py-1.5 rounded-full border transition-all ${
                                app.current_status === s.key
                                  ? 'border-ink bg-ink text-white'
                                  : 'border-mist bg-white text-steel hover:border-blue/30 hover:text-blue'
                              }`}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Details grid */}
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        {app.role_type && (
                          <div>
                            <span className="font-mono text-[10px] text-steel uppercase block mb-1">Role Type</span>
                            <span className="text-ink capitalize">{app.role_type.replace(/_/g, ' ')}</span>
                          </div>
                        )}
                        {app.work_arrangement && (
                          <div>
                            <span className="font-mono text-[10px] text-steel uppercase block mb-1">Arrangement</span>
                            <span className="text-ink capitalize">{app.work_arrangement}</span>
                          </div>
                        )}
                        {app.location_city && (
                          <div>
                            <span className="font-mono text-[10px] text-steel uppercase block mb-1">Location</span>
                            <span className="text-ink flex items-center gap-1"><MapPin size={11} />{app.location_city}</span>
                          </div>
                        )}
                        {app.posting_url && (
                          <div>
                            <span className="font-mono text-[10px] text-steel uppercase block mb-1">Posting</span>
                            <a href={app.posting_url} target="_blank" rel="noopener noreferrer" className="text-blue hover:underline flex items-center gap-1 text-xs"><Link2 size={11} />View</a>
                          </div>
                        )}
                        {app.next_action && (
                          <div>
                            <span className="font-mono text-[10px] text-steel uppercase block mb-1">Next Action</span>
                            <span className="text-ink">{app.next_action}</span>
                          </div>
                        )}
                        {app.next_action_due && (
                          <div>
                            <span className="font-mono text-[10px] text-steel uppercase block mb-1">Due</span>
                            <span className="text-ember font-mono text-xs">{app.next_action_due}</span>
                          </div>
                        )}
                      </div>

                      {app.personal_notes && (
                        <div>
                          <span className="font-mono text-[10px] text-steel uppercase block mb-1">Notes</span>
                          <p className="text-sm text-slate bg-white border border-mist rounded-lg p-3">{app.personal_notes}</p>
                        </div>
                      )}

                      {/* Tags */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {app.tags.map(t => (
                          <span key={t.id} className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-1 rounded-full" style={{ backgroundColor: (t.color || '#e4e9f0') + '20', color: t.color || '#8c95a6' }}>
                            {t.name}
                            <button onClick={() => api.internships.applications.removeTag(app.id, t.id).then(refreshInternships)} className="hover:text-ember"><X size={9} /></button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
        {intApps.length === 0 && (
          <div className="text-center py-16">
            <Target size={32} className="mx-auto text-silver mb-3" />
            <p className="text-steel text-sm">No applications yet. Add your first one!</p>
          </div>
        )}
      </div>
    )

    const renderAddForm = () => {
      const form = intForm
      const set = (k: string, v: string) => setIntForm(prev => ({ ...prev, [k]: v }))

      return (
        <SectionCard>
          <h3 className="font-sans font-semibold text-ink mb-6">New Application</h3>
          <div className="grid grid-cols-2 gap-4">
            <AdminInput label="Company" value={form.company_name} onChange={v => set('company_name', v)} placeholder="e.g. Google" />
            <AdminInput label="Job Title" value={form.job_title} onChange={v => set('job_title', v)} placeholder="e.g. Software Engineer Intern" />
            <AdminInput label="Team" value={form.team} onChange={v => set('team', v)} placeholder="e.g. Search Infra" />
            <AdminSelect label="Role Type" value={form.role_type} onChange={v => set('role_type', v)} options={[
              { value: 'internship', label: 'Internship' }, { value: 'coop', label: 'Co-op' },
              { value: 'new_grad', label: 'New Grad' }, { value: 'full_time', label: 'Full Time' },
              { value: 'contract', label: 'Contract' }, { value: 'part_time', label: 'Part Time' },
            ]} />
            <AdminSelect label="Work Arrangement" value={form.work_arrangement} onChange={v => set('work_arrangement', v)} options={[
              { value: '', label: '— Select —' }, { value: 'onsite', label: 'Onsite' },
              { value: 'hybrid', label: 'Hybrid' }, { value: 'remote', label: 'Remote' },
            ]} />
            <AdminInput label="Location" value={form.location_city} onChange={v => set('location_city', v)} placeholder="e.g. Mountain View, CA" />
            <AdminInput label="Posting URL" value={form.posting_url} onChange={v => set('posting_url', v)} placeholder="https://..." />
            <AdminSelect label="Source" value={form.source} onChange={v => set('source', v)} options={[
              { value: '', label: '— Select —' }, { value: 'linkedin', label: 'LinkedIn' },
              { value: 'indeed', label: 'Indeed' }, { value: 'handshake', label: 'Handshake' },
              { value: 'company_site', label: 'Company Site' }, { value: 'referral', label: 'Referral' },
              { value: 'career_fair', label: 'Career Fair' }, { value: 'recruiter_outreach', label: 'Recruiter Outreach' },
              { value: 'university_portal', label: 'University Portal' }, { value: 'other', label: 'Other' },
            ]} />
            <AdminSelect label="Status" value={form.current_status} onChange={v => set('current_status', v)} options={
              STATUS_PIPELINE.map(s => ({ value: s.key, label: s.label }))
            } />
            <AdminSelect label="Priority" value={form.priority} onChange={v => set('priority', v)} options={[
              { value: 'dream', label: 'Dream' }, { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' },
              { value: 'backup', label: 'Backup' },
            ]} />
            <AdminInput label="Applied On" value={form.applied_on} onChange={v => set('applied_on', v)} type="date" />
            <AdminInput label="Next Action" value={form.next_action} onChange={v => set('next_action', v)} placeholder="e.g. Follow up on application" />
            <AdminInput label="Next Action Due" value={form.next_action_due} onChange={v => set('next_action_due', v)} type="date" />
          </div>
          <div className="mt-4">
            <AdminTextarea label="Notes" value={form.personal_notes} onChange={v => set('personal_notes', v)} rows={3} />
          </div>
          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={() => setIntView('pipeline')}
              className="px-4 py-2.5 bg-cloud text-steel font-mono text-xs rounded-lg hover:bg-mist transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => addApplication(form)}
              disabled={!form.company_name || !form.job_title}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={13} /> Add Application
            </button>
          </div>
        </SectionCard>
      )
    }

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-sans font-semibold text-ink mb-1">Internship Tracker</h2>
            <p className="text-steel text-sm">
              {intApps.length} application{intApps.length !== 1 ? 's' : ''} tracked
              {intApps.filter(a => a.current_status === 'offer' || a.current_status === 'accepted').length > 0 &&
                ` — ${intApps.filter(a => a.current_status === 'offer' || a.current_status === 'accepted').length} offer${intApps.filter(a => a.current_status === 'offer' || a.current_status === 'accepted').length !== 1 ? 's' : ''}`
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(['dashboard', 'pipeline', 'list'] as const).map(v => (
              <button
                key={v}
                onClick={() => setIntView(v)}
                className={`font-mono text-[11px] px-3.5 py-2 rounded-lg transition-all capitalize ${
                  intView === v ? 'bg-blue text-white' : 'bg-white border border-mist text-steel hover:text-blue hover:border-blue/30'
                }`}
              >
                {v === 'dashboard' ? 'Dashboard' : v === 'pipeline' ? 'Pipeline' : 'List'}
              </button>
            ))}
            <button
              onClick={() => setIntView('add')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors shadow-sm ml-2"
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        {intView === 'dashboard' && renderIntDashboard()}
        {intView === 'pipeline' && renderPipeline()}
        {intView === 'list' && renderList()}
        {intView === 'add' && renderAddForm()}
      </motion.div>
    )
  }

  // ── Bookings helpers ────────────────────────────────────────────────────
  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const COMMON_TIMEZONES = [
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin',
    'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney', 'UTC',
  ]

  const refreshBookings = async () => {
    try {
      const [bookings, windows, blocked, settings] = await Promise.all([
        api.bookings.list(),
        api.bookings.availability.list(),
        api.bookings.blockedDates.list(),
        api.bookings.settings.get(),
      ])
      setBkBookings(bookings); setBkWindows(windows); setBkBlocked(blocked); setBkSettings(settings)
    } catch (err) { showError((err as Error).message) }
  }

  const handleBkAccept = async (id: number) => {
    try {
      const updated = await api.bookings.accept(id)
      setBkBookings(bkBookings.map(b => b.id === id ? updated : b))
      showToast('Booking accepted')
      setBkConfirmAction(null)
    } catch (err) { showError((err as Error).message) }
  }

  const handleBkDecline = async (id: number) => {
    try {
      await api.bookings.decline(id, { admin_note: bkDeclineNote[id] || undefined })
      showToast('Booking declined')
      setBkShowDecline(null)
      setBkConfirmAction(null)
      refreshBookings()
    } catch (err) { showError((err as Error).message) }
  }

  const handleBkDelete = async (id: number) => {
    try {
      await api.bookings.delete(id)
      setBkBookings(bkBookings.filter(b => b.id !== id))
      showToast('Booking cancelled')
      setBkConfirmAction(null)
    } catch (err) { showError((err as Error).message) }
  }

  const renderBookings = () => {
    const pendingBookings = bkBookings.filter(b => b.status === 'pending')
    const upcomingBookings = bkBookings.filter(b => b.status === 'confirmed' && new Date(b.start_at) > new Date())
    const pastBookings = bkBookings.filter(b => b.status !== 'pending' && (b.status !== 'confirmed' || new Date(b.start_at) <= new Date()))

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-sans font-semibold text-ink mb-1">Bookings</h2>
            <p className="text-steel text-sm">
              {pendingBookings.length} pending · {upcomingBookings.length} upcoming
            </p>
          </div>
          <div className="flex gap-2">
            {(['pending', 'upcoming', 'past', 'settings'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setBkTab(tab)}
                className={`font-mono text-[11px] px-3.5 py-2 rounded-lg transition-all capitalize ${
                  bkTab === tab ? 'bg-blue text-white' : 'bg-white border border-mist text-steel hover:text-blue hover:border-blue/30'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {bkTab === 'pending' && (
          <div className="space-y-3">
            {pendingBookings.length === 0 ? (
              <p className="text-steel text-sm text-center py-12">No pending booking requests.</p>
            ) : pendingBookings.map(b => (
              <SectionCard key={b.id}>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h4 className="font-semibold text-ink">{b.visitor_name}</h4>
                    <p className="font-mono text-xs text-steel">{b.visitor_email}</p>
                    <p className="text-sm text-ink mt-2">{b.topic}</p>
                    <p className="font-mono text-xs text-steel mt-1">
                      {new Date(b.start_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      {' · '}{b.duration_minutes} min
                    </p>
                    <p className="font-mono text-[10px] text-silver mt-1">
                      Requested {new Date(b.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0 ml-4">
                    <button
                      onClick={() => setBkConfirmAction({ type: 'accept', id: b.id })}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal text-white font-mono text-xs font-semibold rounded-lg hover:bg-teal/90 transition-colors"
                    >
                      <Check size={13} /> Accept
                    </button>
                    <button
                      onClick={() => setBkShowDecline(bkShowDecline === b.id ? null : b.id)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 border border-mist text-steel font-mono text-xs rounded-lg hover:text-ember hover:border-ember/30 transition-colors"
                    >
                      <Ban size={13} /> Decline
                    </button>
                  </div>
                </div>
                <AnimatePresence>
                  {bkShowDecline === b.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="mt-4 pt-4 border-t border-mist space-y-3">
                        <AdminTextarea
                          label="Decline note (optional)"
                          value={bkDeclineNote[b.id] || ''}
                          onChange={v => setBkDeclineNote({ ...bkDeclineNote, [b.id]: v })}
                          rows={2}
                        />
                        <button
                          onClick={() => handleBkDecline(b.id)}
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-ember text-white font-mono text-xs font-semibold rounded-lg hover:bg-ember/90 transition-colors"
                        >
                          Confirm Decline
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </SectionCard>
            ))}
          </div>
        )}

        {bkTab === 'upcoming' && (
          <div className="space-y-3">
            {upcomingBookings.length === 0 ? (
              <p className="text-steel text-sm text-center py-12">No upcoming calls.</p>
            ) : upcomingBookings.map(b => (
              <SectionCard key={b.id}>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h4 className="font-semibold text-ink">{b.visitor_name}</h4>
                    <p className="text-sm text-ink">{b.topic}</p>
                    <p className="font-mono text-xs text-steel">
                      {new Date(b.start_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      {' · '}{b.duration_minutes} min
                    </p>
                    {b.zoom_join_url && (
                      <div className="flex items-center gap-2 mt-2">
                        <a href={b.zoom_join_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-blue font-mono text-xs hover:underline">
                          <Video size={13} /> Join Zoom
                        </a>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(b.zoom_join_url!)
                            setBkCopied(b.id)
                            setTimeout(() => setBkCopied(null), 2000)
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-steel hover:text-blue font-mono text-[10px] bg-cloud rounded-md transition-colors"
                        >
                          {bkCopied === b.id ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy link</>}
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setBkConfirmAction({ type: 'cancel', id: b.id })}
                    className="p-2 text-steel hover:text-ember transition-colors"
                    title="Cancel booking"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </SectionCard>
            ))}
          </div>
        )}

        {bkTab === 'past' && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-silver">Sort:</span>
                {(['date', 'name', 'status'] as const).map(s => (
                  <button key={s} onClick={() => setBkPastSort(s)} className={`font-mono text-[10px] px-2 py-1 rounded transition-all capitalize ${bkPastSort === s ? 'bg-blue text-white' : 'text-steel hover:text-ink'}`}>{s}</button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] text-silver">Filter:</span>
                {['all', 'confirmed', 'declined', 'cancelled'].map(f => (
                  <button key={f} onClick={() => setBkPastFilter(f)} className={`font-mono text-[10px] px-2 py-1 rounded transition-all capitalize ${bkPastFilter === f ? 'bg-blue text-white' : 'text-steel hover:text-ink'}`}>{f}</button>
                ))}
              </div>
            </div>
            {(() => {
              let filtered = pastBookings.filter(b => bkPastFilter === 'all' || b.status === bkPastFilter)
              if (bkPastSort === 'date') filtered = [...filtered].sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime())
              else if (bkPastSort === 'name') filtered = [...filtered].sort((a, b) => a.visitor_name.localeCompare(b.visitor_name))
              else if (bkPastSort === 'status') filtered = [...filtered].sort((a, b) => a.status.localeCompare(b.status))
              return filtered.length === 0 ? (
                <p className="text-steel text-sm text-center py-12">No past bookings{bkPastFilter !== 'all' ? ` with status "${bkPastFilter}"` : ''}.</p>
              ) : filtered.map(b => (
                <SectionCard key={b.id}>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium text-ink">{b.visitor_name} — {b.topic}</h4>
                      <p className="font-mono text-xs text-steel">
                        {new Date(b.start_at).toLocaleDateString()} · {b.duration_minutes} min ·{' '}
                        <span className={b.status === 'confirmed' ? 'text-teal' : b.status === 'declined' ? 'text-ember' : 'text-steel'}>
                          {b.status}
                        </span>
                      </p>
                      {b.admin_note && <p className="text-xs text-steel italic mt-1">{b.admin_note}</p>}
                    </div>
                  </div>
                </SectionCard>
              ))
            })()}
          </div>
        )}

        {bkTab === 'settings' && bkSettings && (
          <div className="space-y-8">
            {/* Global settings */}
            <SectionCard>
              <h3 className="font-sans font-semibold text-ink mb-5">Global Settings</h3>
              <div className="space-y-5">
                <AdminSelect
                  label="Timezone"
                  value={bkSettings.timezone}
                  onChange={async v => {
                    try {
                      const updated = await api.bookings.settings.update({ timezone: v })
                      setBkSettings(updated)
                      showToast('Timezone updated')
                    } catch (err) { showError((err as Error).message) }
                  }}
                  options={COMMON_TIMEZONES.map(tz => ({ value: tz, label: tz }))}
                />
                <div>
                  <label className="block font-mono text-[11px] text-steel mb-1.5 tracking-wider uppercase">Booking Enabled</label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bkSettings.enabled}
                      onChange={async e => {
                        try {
                          const updated = await api.bookings.settings.update({ enabled: e.target.checked })
                          setBkSettings(updated)
                          showToast(e.target.checked ? 'Booking enabled' : 'Booking disabled')
                        } catch (err) { showError((err as Error).message) }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm text-ink">{bkSettings.enabled ? 'Enabled' : 'Disabled'}</span>
                  </label>
                </div>
              </div>
            </SectionCard>

            {/* Availability windows */}
            <SectionCard>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-sans font-semibold text-ink">Availability Windows</h3>
                <button
                  onClick={async () => {
                    try {
                      const w = await api.bookings.availability.create({ day_of_week: 1, start_time: '09:00', end_time: '17:00', allowed_durations: [30], enabled: true })
                      setBkWindows([...bkWindows, w])
                      showToast('Window added')
                    } catch (err) { showError((err as Error).message) }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-blue bg-blue-wash rounded-lg hover:bg-blue/10 transition-colors"
                >
                  <Plus size={12} /> Add
                </button>
              </div>
              <div className="space-y-4">
                {bkWindows.map(w => (
                  <div key={w.id} className="flex items-center gap-3 p-4 bg-cloud rounded-xl">
                    <select
                      value={w.day_of_week}
                      onChange={async e => {
                        try {
                          const updated = await api.bookings.availability.update(w.id, { day_of_week: Number(e.target.value) })
                          setBkWindows(bkWindows.map(x => x.id === w.id ? updated : x))
                        } catch (err) { showError((err as Error).message) }
                      }}
                      className="px-2 py-1.5 bg-white border border-mist rounded-lg text-sm text-ink font-mono"
                    >
                      {DAY_LABELS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                    <input
                      type="time"
                      value={w.start_time}
                      onChange={async e => {
                        try {
                          const updated = await api.bookings.availability.update(w.id, { start_time: e.target.value })
                          setBkWindows(bkWindows.map(x => x.id === w.id ? updated : x))
                        } catch (err) { showError((err as Error).message) }
                      }}
                      className="px-2 py-1.5 bg-white border border-mist rounded-lg text-sm text-ink font-mono"
                    />
                    <span className="text-steel text-xs">to</span>
                    <input
                      type="time"
                      value={w.end_time}
                      onChange={async e => {
                        try {
                          const updated = await api.bookings.availability.update(w.id, { end_time: e.target.value })
                          setBkWindows(bkWindows.map(x => x.id === w.id ? updated : x))
                        } catch (err) { showError((err as Error).message) }
                      }}
                      className="px-2 py-1.5 bg-white border border-mist rounded-lg text-sm text-ink font-mono"
                    />
                    <div className="flex items-center gap-2 ml-2">
                      {[15, 30].map(dur => (
                        <label key={dur} className="flex items-center gap-1 text-xs font-mono text-steel cursor-pointer">
                          <input
                            type="checkbox"
                            checked={w.allowed_durations.includes(dur)}
                            onChange={async e => {
                              const newDurs = e.target.checked
                                ? [...w.allowed_durations, dur].sort((a, b) => a - b)
                                : w.allowed_durations.filter(d => d !== dur)
                              if (newDurs.length === 0) return
                              try {
                                const updated = await api.bookings.availability.update(w.id, { allowed_durations: newDurs })
                                setBkWindows(bkWindows.map(x => x.id === w.id ? updated : x))
                              } catch (err) { showError((err as Error).message) }
                            }}
                            className="rounded"
                          />
                          {dur}m
                        </label>
                      ))}
                    </div>
                    <label className="flex items-center gap-1 text-xs font-mono text-steel ml-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={w.enabled}
                        onChange={async e => {
                          try {
                            const updated = await api.bookings.availability.update(w.id, { enabled: e.target.checked })
                            setBkWindows(bkWindows.map(x => x.id === w.id ? updated : x))
                          } catch (err) { showError((err as Error).message) }
                        }}
                        className="rounded"
                      />
                      On
                    </label>
                    <button
                      onClick={async () => {
                        try {
                          await api.bookings.availability.delete(w.id)
                          setBkWindows(bkWindows.filter(x => x.id !== w.id))
                          showToast('Window deleted')
                        } catch (err) { showError((err as Error).message) }
                      }}
                      className="p-1.5 text-steel hover:text-ember transition-colors ml-auto"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                {bkWindows.length === 0 && (
                  <p className="text-steel text-sm text-center py-4">No availability windows configured.</p>
                )}
              </div>
            </SectionCard>

            {/* Blocked dates */}
            <SectionCard>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-sans font-semibold text-ink">Blocked Dates</h3>
                <button
                  onClick={() => setBkShowBlockPicker(!bkShowBlockPicker)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-blue bg-blue-wash rounded-lg hover:bg-blue/10 transition-colors"
                >
                  <Plus size={12} /> Block Date
                </button>
              </div>

              <AnimatePresence>
                {bkShowBlockPicker && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-5">
                    <div className="p-4 bg-cloud rounded-xl border border-mist space-y-4">
                      {/* Month navigation */}
                      <div className="flex items-center justify-between">
                        <button onClick={() => setBkBlockMonth(new Date(bkBlockMonth.getFullYear(), bkBlockMonth.getMonth() - 1, 1))} className="p-1.5 rounded-lg text-steel hover:text-ink hover:bg-white transition-colors"><ChevronLeft size={16} /></button>
                        <span className="font-mono text-sm text-ink font-medium">
                          {bkBlockMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                        </span>
                        <button onClick={() => setBkBlockMonth(new Date(bkBlockMonth.getFullYear(), bkBlockMonth.getMonth() + 1, 1))} className="p-1.5 rounded-lg text-steel hover:text-ink hover:bg-white transition-colors"><ChevronRight size={16} /></button>
                      </div>
                      {/* Day headers */}
                      <div className="grid grid-cols-7 gap-1 text-center">
                        {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d => (
                          <span key={d} className="font-mono text-[10px] text-silver py-1">{d}</span>
                        ))}
                      </div>
                      {/* Calendar grid */}
                      <div className="grid grid-cols-7 gap-1">
                        {(() => {
                          const year = bkBlockMonth.getFullYear()
                          const month = bkBlockMonth.getMonth()
                          const firstDay = new Date(year, month, 1)
                          const lastDay = new Date(year, month + 1, 0)
                          const startPad = (firstDay.getDay() + 6) % 7 // Mon=0
                          const cells: React.ReactNode[] = []
                          for (let i = 0; i < startPad; i++) cells.push(<div key={`pad-${i}`} />)
                          for (let d = 1; d <= lastDay.getDate(); d++) {
                            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                            const isBlocked = bkBlocked.some(b => b.date === dateStr)
                            const isPast = new Date(year, month, d) < new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())
                            cells.push(
                              <button
                                key={d}
                                disabled={isPast}
                                onClick={async () => {
                                  if (isBlocked) {
                                    const blocked = bkBlocked.find(b => b.date === dateStr)
                                    if (!blocked) return
                                    try {
                                      await api.bookings.blockedDates.delete(blocked.id)
                                      setBkBlocked(bkBlocked.filter(x => x.id !== blocked.id))
                                      showToast(`${dateStr} unblocked`)
                                    } catch (err) { showError((err as Error).message) }
                                    return
                                  }
                                  try {
                                    const created = await api.bookings.blockedDates.create({ date: dateStr, reason: bkBlockReason || undefined })
                                    setBkBlocked([...bkBlocked, created])
                                    showToast(`${dateStr} blocked`)
                                  } catch (err) { showError((err as Error).message) }
                                }}
                                className={`aspect-square rounded-lg text-xs font-mono flex items-center justify-center transition-all ${
                                  isBlocked
                                    ? 'bg-ember/10 text-ember font-semibold border border-ember/20'
                                    : isPast
                                    ? 'text-silver/40 cursor-not-allowed'
                                    : 'text-ink hover:bg-blue-wash hover:text-blue cursor-pointer'
                                }`}
                              >
                                {d}
                              </button>
                            )
                          }
                          return cells
                        })()}
                      </div>
                      {/* Reason input */}
                      <div>
                        <label className="block font-mono text-[10px] text-steel mb-1 tracking-wider uppercase">Reason (optional)</label>
                        <input
                          type="text"
                          value={bkBlockReason}
                          onChange={e => setBkBlockReason(e.target.value)}
                          placeholder="e.g. Vacation, Holiday"
                          className="w-full px-3 py-2 bg-white border border-mist rounded-lg text-sm text-ink placeholder-silver focus:outline-none focus:border-blue/50 transition-colors"
                        />
                      </div>
                      <p className="font-mono text-[10px] text-silver">Click to block/unblock dates. Blocked dates shown in red.</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                {bkBlocked.map(d => (
                  <div key={d.id} className="flex items-center justify-between p-3 bg-cloud rounded-lg">
                    <div>
                      <span className="font-mono text-sm text-ink">{d.date}</span>
                      {d.reason && <span className="text-xs text-steel ml-3">{d.reason}</span>}
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          await api.bookings.blockedDates.delete(d.id)
                          setBkBlocked(bkBlocked.filter(x => x.id !== d.id))
                          showToast('Date unblocked')
                        } catch (err) { showError((err as Error).message) }
                      }}
                      className="p-1.5 text-steel hover:text-ember transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                {bkBlocked.length === 0 && (
                  <p className="text-steel text-sm text-center py-4">No dates blocked.</p>
                )}
              </div>
            </SectionCard>
          </div>
        )}

        {/* Confirmation dialog */}
        <AnimatePresence>
          {bkConfirmAction && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40"
              onClick={() => setBkConfirmAction(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <h3 className="font-sans font-semibold text-ink text-lg mb-2 capitalize">
                  {bkConfirmAction.type} booking?
                </h3>
                <p className="text-steel text-sm mb-6">
                  {bkConfirmAction.type === 'accept' && 'This will create a Zoom meeting and send confirmation emails to both parties.'}
                  {bkConfirmAction.type === 'decline' && 'This will notify the visitor that their request has been declined.'}
                  {bkConfirmAction.type === 'cancel' && 'This will cancel the booking, delete any Zoom meeting, and notify the visitor.'}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setBkConfirmAction(null)}
                    className="flex-1 px-4 py-2.5 border border-mist text-steel font-mono text-xs rounded-lg hover:bg-cloud transition-colors"
                  >
                    Nevermind
                  </button>
                  <button
                    onClick={() => {
                      if (bkConfirmAction.type === 'accept') handleBkAccept(bkConfirmAction.id)
                      else if (bkConfirmAction.type === 'decline') handleBkDecline(bkConfirmAction.id)
                      else handleBkDelete(bkConfirmAction.id)
                    }}
                    className={`flex-1 px-4 py-2.5 text-white font-mono text-xs font-semibold rounded-lg transition-colors ${
                      bkConfirmAction.type === 'accept' ? 'bg-teal hover:bg-teal/90' : 'bg-ember hover:bg-ember/90'
                    }`}
                  >
                    {bkConfirmAction.type === 'accept' ? 'Accept' : bkConfirmAction.type === 'decline' ? 'Decline' : 'Cancel Booking'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }

  const sectionRenderers: Record<string, () => React.ReactNode> = {
    overview: renderOverview,
    projects: renderProjects,
    skills: renderSkills,
    experience: renderExperience,
    about: renderAbout,
    coursework: renderCoursework,
    contact: renderContact,
    blog: renderBlog,
    files: renderFiles,
    links: renderLinks,
    bookings: renderBookings,
    internships: renderInternships,
  }

  return (
    <div className="min-h-screen bg-cloud flex">
      {/* ── Sidebar ── */}
      <aside className="w-64 bg-white border-r border-mist flex flex-col fixed top-0 left-0 bottom-0 z-40">
        <div className="p-6 border-b border-mist">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue rounded-lg flex items-center justify-center">
              <span className="font-mono text-white text-sm font-bold">NB</span>
            </div>
            <div>
              <span className="text-sm font-medium text-ink block leading-tight">Admin Panel</span>
              <span className="font-mono text-[10px] text-steel tracking-wider">PORTFOLIO CMS</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {sections.map(section => {
            const isActive = activeSection === section.id
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all ${
                  isActive
                    ? 'bg-blue-wash text-blue font-medium'
                    : 'text-steel hover:text-ink hover:bg-cloud'
                }`}
              >
                <section.icon size={16} />
                {section.label}
              </button>
            )
          })}
        </nav>

        <div className="p-4 border-t border-mist space-y-2">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-mist text-sm text-steel hover:text-blue hover:border-blue/30 transition-all"
          >
            <Eye size={14} /> View Live Site
          </a>
          <button
            onClick={() => api.auth.logout().then(() => navigate('/admin/login'))}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm text-steel hover:text-ember hover:bg-ember/5 transition-all"
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 ml-64 p-10">
        <div className="max-w-[960px]">
          <AnimatePresence mode="wait">
            <motion.div key={activeSection}>
              {sectionRenderers[activeSection]?.()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  )
}
