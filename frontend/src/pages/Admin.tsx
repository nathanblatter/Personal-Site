import { useState, useEffect, useCallback } from 'react'
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
import { Toast } from './admin/AdminShared'
import AdminThemePicker from './admin/AdminThemePicker'
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
  const [activeSection, setActiveSection] = useState('overview')
  const [isLoading, setIsLoading] = useState(true)

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

  const [toast, setToast] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }, [])
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

  return (
    <div className="min-h-screen bg-cloud flex" style={theme.vars as React.CSSProperties}>
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
          <AdminThemePicker themeId={themeId} setTheme={setTheme} />
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
