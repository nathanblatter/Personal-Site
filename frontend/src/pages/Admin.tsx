import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  LayoutDashboard,
  FolderKanban,
  BarChart3,
  Briefcase,
  User,
  AtSign,
  Eye,
  BookOpen,
  Loader2,
  LogOut,
  FileText,
  Target,
  Link2,
  HardDrive,
  Calendar,
  Handshake,
  FileStack,
  ChevronsLeft,
  ChevronsRight,
  Rows3,
  Rows2,
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
  type TestimonialResponse,
} from '../lib/api'
import { Toast, type ToastAction } from './admin/AdminShared'
import AdminThemePicker from './admin/AdminThemePicker'
import AdminCommandPalette from './admin/AdminCommandPalette'
import { useAdminTheme } from '../lib/adminThemes'
import OverviewSection from './admin/OverviewSection'
import ProjectsSection from './admin/ProjectsSection'
import SkillsSection from './admin/SkillsSection'
import ExperienceSection from './admin/ExperienceSection'
import AboutSection from './admin/AboutSection'
import CourseworkSection from './admin/CourseworkSection'
import ContactSection from './admin/ContactSection'
import BlogSection from './admin/BlogSection'
import FilesSection from './admin/FilesSection'
import LinksSection from './admin/LinksSection'
import BookingsSection from './admin/BookingsSection'
import BioSection from './admin/BioSection'
import InternshipsSection from './admin/InternshipsSection'
import ConsultingSection from './admin/ConsultingSection'
import PagesSection from './admin/PagesSection'

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
  { id: 'pages', label: 'Pages', icon: FileStack },
  { id: 'files', label: 'Files', icon: HardDrive },
  { id: 'links', label: 'Links', icon: Link2 },
  { id: 'bookings', label: 'Bookings', icon: Calendar },
  { id: 'consulting', label: 'Consulting', icon: Handshake },
  { id: 'bio', label: 'Link in Bio', icon: Link2 },
  { id: 'internships', label: 'Internships', icon: Target },
]

/* ═══════════════════════════════════════════════
   MAIN ADMIN PAGE
   ═══════════════════════════════════════════════ */

export default function Admin() {
  const navigate = useNavigate()
  const { themeId, theme, setTheme } = useAdminTheme()
  const [activeSection, setActiveSection] = useState(() => {
    try {
      const stored = localStorage.getItem('admin-section')
      return stored && sections.some(s => s.id === stored) ? stored : 'overview'
    } catch { return 'overview' }
  })
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('admin-sidebar-collapsed') === '1' } catch { return false }
  })
  const [compact, setCompact] = useState(() => {
    try { return localStorage.getItem('admin-density') === 'compact' } catch { return false }
  })
  const [isLoading, setIsLoading] = useState(true)

  // Persist UI preferences.
  useEffect(() => { try { localStorage.setItem('admin-section', activeSection) } catch { /* ignore */ } }, [activeSection])
  useEffect(() => { try { localStorage.setItem('admin-sidebar-collapsed', collapsed ? '1' : '0') } catch { /* ignore */ } }, [collapsed])
  useEffect(() => { try { localStorage.setItem('admin-density', compact ? 'compact' : 'comfortable') } catch { /* ignore */ } }, [compact])

  // ── Shared data state (loaded once, used across sections) ───────────────
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

  const [toast, setToast] = useState<{ message: string; action?: ToastAction } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const showToast = useCallback((msg: string, action?: ToastAction) => {
    clearTimeout(toastTimer.current)
    setToast({ message: msg, action })
    // Keep action toasts (e.g. Undo) up long enough to act, but dismiss before
    // the underlying delete commits at 5s.
    toastTimer.current = setTimeout(() => setToast(null), action ? 4500 : 3000)
  }, [])
  const showError = useCallback((msg: string) => showToast(`Error: ${msg}`), [showToast])

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
  }, [navigate, showError])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cloud flex items-center justify-center" style={theme.vars as React.CSSProperties}>
        <div className="flex flex-col items-center gap-4 text-steel">
          <Loader2 size={32} className="animate-spin text-blue" />
          <span className="font-mono text-sm tracking-wider">Loading admin panel…</span>
        </div>
      </div>
    )
  }

  const sectionRenderers: Record<string, () => React.ReactNode> = {
    overview: () => <OverviewSection projects={projects} skills={skills} experience={experience} coursework={coursework} />,
    projects: () => <ProjectsSection showToast={showToast} showError={showError} projects={projects} setProjects={setProjects} />,
    skills: () => <SkillsSection showToast={showToast} showError={showError} skills={skills} setSkills={setSkills} />,
    experience: () => <ExperienceSection showToast={showToast} showError={showError} experience={experience} setExperience={setExperience} />,
    about: () => (
      <AboutSection
        showToast={showToast}
        showError={showError}
        about={about}
        setAbout={setAbout}
        interests={interests}
        setInterests={setInterests}
        testimonials={testimonials}
        setTestimonials={setTestimonials}
      />
    ),
    coursework: () => <CourseworkSection showToast={showToast} showError={showError} coursework={coursework} setCoursework={setCoursework} />,
    contact: () => <ContactSection showToast={showToast} showError={showError} socials={socials} setSocials={setSocials} contactMeta={contactMeta} setContactMeta={setContactMeta} />,
    blog: () => <BlogSection showToast={showToast} showError={showError} blogs={blogs} setBlogs={setBlogs} />,
    pages: () => <PagesSection showToast={showToast} showError={showError} />,
    files: () => <FilesSection showToast={showToast} showError={showError} />,
    links: () => (
      <LinksSection
        showToast={showToast}
        showError={showError}
        projects={projects}
        skills={skills}
        experience={experience}
        interests={interests}
        testimonials={testimonials}
        about={about}
      />
    ),
    bookings: () => <BookingsSection showToast={showToast} showError={showError} />,
    consulting: () => <ConsultingSection showToast={showToast} showError={showError} />,
    bio: () => <BioSection showToast={showToast} showError={showError} />,
    internships: () => <InternshipsSection showToast={showToast} showError={showError} />,
  }

  const logout = () => api.auth.logout().then(() => navigate('/admin/login'))

  return (
    <div className="min-h-screen bg-cloud flex" style={theme.vars as React.CSSProperties}>
      {/* ── Sidebar ── */}
      <aside className={`${collapsed ? 'w-20' : 'w-64'} bg-white border-r border-mist flex flex-col fixed top-0 left-0 bottom-0 z-40 transition-[width] duration-200`}>
        <div className={`border-b border-mist ${collapsed ? 'p-3 flex flex-col items-center gap-3' : 'p-4 flex items-center justify-between gap-2'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-blue rounded-lg flex items-center justify-center shrink-0">
              <span className="font-mono text-white text-sm font-bold">NB</span>
            </div>
            {!collapsed && (
              <div>
                <span className="text-sm font-medium text-ink block leading-tight">Admin Panel</span>
                <span className="font-mono text-[10px] text-steel tracking-wider">PORTFOLIO CMS</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 rounded-lg text-steel hover:text-ink hover:bg-cloud transition-colors shrink-0"
          >
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {sections.map(section => {
            const isActive = activeSection === section.id
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                title={collapsed ? section.label : undefined}
                className={`w-full flex items-center gap-3 rounded-lg text-sm transition-all ${collapsed ? 'justify-center px-0' : 'px-4'} ${compact ? 'py-2' : 'py-2.5'} ${
                  isActive ? 'bg-blue-wash text-blue font-medium' : 'text-steel hover:text-ink hover:bg-cloud'
                }`}
              >
                <section.icon size={16} className="shrink-0" />
                {!collapsed && section.label}
              </button>
            )
          })}
        </nav>

        <div className="p-3 border-t border-mist space-y-2">
          {collapsed ? (
            <>
              <button onClick={() => setCompact(c => !c)} title={compact ? 'Comfortable density' : 'Compact density'} className="w-full flex justify-center py-2 rounded-lg text-steel hover:text-blue hover:bg-cloud transition-all">
                {compact ? <Rows3 size={16} /> : <Rows2 size={16} />}
              </button>
              <a href="/" target="_blank" rel="noopener noreferrer" title="View live site" className="w-full flex justify-center py-2 rounded-lg text-steel hover:text-blue hover:bg-cloud transition-all">
                <Eye size={16} />
              </a>
              <button onClick={logout} title="Logout" className="w-full flex justify-center py-2 rounded-lg text-steel hover:text-ember hover:bg-ember/5 transition-all">
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <>
              <AdminThemePicker themeId={themeId} setTheme={setTheme} />
              <button
                onClick={() => setCompact(c => !c)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-mist text-sm text-steel hover:text-blue hover:border-blue/30 transition-all"
              >
                {compact ? <Rows3 size={14} /> : <Rows2 size={14} />}
                <span className="flex-1 text-left">{compact ? 'Comfortable' : 'Compact'}</span>
              </button>
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-mist text-sm text-steel hover:text-blue hover:border-blue/30 transition-all"
              >
                <Eye size={14} /> View Live Site
              </a>
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm text-steel hover:text-ember hover:bg-ember/5 transition-all"
              >
                <LogOut size={14} /> Logout
              </button>
            </>
          )}
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className={`flex-1 ${collapsed ? 'ml-20' : 'ml-64'} ${compact ? 'p-6' : 'p-10'} transition-[margin] duration-200`}>
        <div className="max-w-[960px]">
          <AnimatePresence mode="wait">
            <motion.div key={activeSection}>
              {sectionRenderers[activeSection]?.()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* ── Command palette (⌘K) ── */}
      <AdminCommandPalette
        sections={sections}
        onNavigate={setActiveSection}
        onSetTheme={setTheme}
        onLogout={logout}
      />

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && <Toast message={toast.message} action={toast.action} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  )
}
