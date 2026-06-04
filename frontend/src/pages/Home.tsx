import { useState, useEffect, lazy, Suspense } from 'react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, MapPin, GraduationCap } from 'lucide-react'
import SectionHeader from '../components/SectionHeader'
import ProjectCard from '../components/ProjectCard'
import SkillBar from '../components/SkillBar'
import TimelineItem from '../components/TimelineItem'
import GitHubSection from '../components/GitHubSection'
import Skeleton from '../components/Skeleton'
import { api, type ProjectResponse, type SkillResponse, type ExperienceResponse, type AboutResponse } from '../lib/api'
import { usePortfolioCtx } from '../lib/usePortfolioCtx'

const LiveStatus = lazy(() => import('../components/LiveStatus'))

export default function Home() {
  const [projects, setProjects] = useState<ProjectResponse[]>([])
  const [skills, setSkills] = useState<SkillResponse[]>([])
  const [experience, setExperience] = useState<ExperienceResponse[]>([])
  const [about, setAbout] = useState<AboutResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const portfolioCtx = usePortfolioCtx()

  useEffect(() => {
    api.home.get().then(({ projects: p, skills: s, experience: e, about: a }) => {
      setProjects(p); setSkills(s); setExperience(e); setAbout(a)
    }).finally(() => setLoading(false))
  }, [])

  const visibleProjects = portfolioCtx
    ? projects.filter(p => (portfolioCtx.projects?.[p.project_id]?.visibility ?? 'show') !== 'hide')
    : projects
  const featuredProjects = visibleProjects.slice(0, 3)

  const visibleSkills = portfolioCtx
    ? skills.filter(s => (portfolioCtx.skills?.[String(s.id)]?.visibility ?? 'show') !== 'hide')
    : skills

  const visibleExperience = experience.filter(e => {
    if (!e.active) return false
    if (!portfolioCtx) return true
    return (portfolioCtx.experience?.[String(e.id)]?.visibility ?? 'show') !== 'hide'
  })


  return (
    <>
      {portfolioCtx?.company && (
        <div className="bg-blue-wash border-b border-blue/10 py-2 text-center">
          <span className="font-mono text-xs text-blue">
            Hi {portfolioCtx.company} — thanks for taking a look
          </span>
        </div>
      )}

      {/* ═══ HERO ═══ */}
      <section className="min-h-[85vh] flex items-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.35]" style={{
          backgroundImage: `radial-gradient(circle, var(--color-mist) 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }} />
        <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-blue/[0.04] rounded-full blur-[120px]" />

        <div className="relative max-w-[900px] w-full mx-auto px-6 text-center py-12 md:py-20">
          <div
            className="flex items-center justify-center gap-4 mb-6 md:mb-8 animate-fade-up"
            style={{ animationDelay: '0.2s' }}
          >
            <div className="h-px w-8 md:w-12 bg-blue" />
            <span className="font-mono text-[10px] md:text-xs text-blue tracking-[0.3em] uppercase">
              Information Systems
            </span>
            <div className="h-px w-8 md:w-12 bg-blue" />
          </div>

          <h1
            className="text-6xl sm:text-8xl md:text-[120px] font-serif italic text-ink leading-[0.9] mb-6 md:mb-8 animate-fade-up"
            style={{ animationDelay: '0.4s' }}
          >
            Nathan<br />
            <span className="text-gradient-blue">Blatter</span>
          </h1>

          <p
            className="text-base md:text-xl text-steel max-w-[560px] mx-auto leading-relaxed mb-8 md:mb-10 animate-fade-up"
            style={{ animationDelay: '0.6s' }}
          >
            {portfolioCtx?.tagline ? portfolioCtx.tagline : (
              <>
                IS student skilled in full-stack engineering, AI-driven applications, and{' '}
                <span className="text-ink font-medium">data analytics</span>. Translating{' '}
                <span className="text-ink font-medium">business requirements</span> into
                production-ready systems.
              </>
            )}
          </p>

          <div
            className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-5 mb-12 md:mb-16 animate-fade-up"
            style={{ animationDelay: '0.8s' }}
          >
            <Link
              to="/projects"
              className="group inline-flex items-center justify-center gap-3 px-7 py-3.5 bg-blue text-white font-mono text-sm font-semibold rounded-xl hover:bg-blue-dim transition-colors shadow-lg shadow-blue/20"
            >
              View Projects
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/contact"
              className="group inline-flex items-center justify-center gap-3 px-7 py-3.5 border border-mist text-ink font-mono text-sm rounded-xl hover:border-blue hover:text-blue transition-colors"
            >
              Get In Touch
              <ArrowUpRight size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          </div>

          <div
            className="flex flex-wrap justify-center gap-6 md:gap-10 pt-8 border-t border-mist animate-fade-in"
            style={{ animationDelay: '1.2s' }}
          >
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-blue" />
              <span className="font-mono text-xs text-steel">Provo, UT</span>
            </div>
            <div className="flex items-center gap-2">
              <GraduationCap size={14} className="text-blue" />
              <span className="font-mono text-xs text-steel">BYU — IS Major</span>
            </div>
            {about?.gpa && (
              <div className="font-mono text-xs text-steel">
                <span className="text-blue font-semibold">{about.gpa}</span> GPA
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══ LIVE STATUS ═══ */}
      <section className="py-8 md:py-12">
        <div className="max-w-[700px] w-full mx-auto px-6">
          <Suspense fallback={null}>
            <LiveStatus />
          </Suspense>
        </div>
      </section>

      {/* ═══ FEATURED PROJECTS ═══ */}
      <section className="py-16 md:py-28 bg-snow">
        <div className="max-w-[1100px] w-full mx-auto px-6">
          <SectionHeader
            code="// 01"
            title="Projects"
            subtitle="Selected work from research, coursework, and real-world clients."
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-7">
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-mist bg-white overflow-hidden">
                    <Skeleton className="h-1.5 w-full rounded-none" />
                    <div className="p-7 space-y-4">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-5/6" />
                      <Skeleton className="h-3 w-2/3" />
                      <div className="flex gap-2 pt-2">
                        <Skeleton className="h-6 w-14 rounded-full" />
                        <Skeleton className="h-6 w-14 rounded-full" />
                        <Skeleton className="h-6 w-14 rounded-full" />
                      </div>
                    </div>
                  </div>
                ))
              : featuredProjects.map((project, i) => (
                  <ProjectCard key={project.id} project={project} index={i} />
                ))
            }
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-10 md:mt-14 text-center"
          >
            <Link
              to="/projects"
              className="group inline-flex items-center gap-2 font-mono text-sm text-steel hover:text-blue transition-colors"
            >
              View all projects
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ═══ SKILLS ═══ */}
      <section className="py-16 md:py-28">
        <div className="max-w-[700px] w-full mx-auto px-6">
          <SectionHeader
            code="// 02"
            title="Skills"
            subtitle="Languages, frameworks, and tools I work with."
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {loading
              ? Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 rounded-xl border border-mist bg-snow space-y-2">
                    <Skeleton className="h-2 w-12" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))
              : visibleSkills.map((skill, i) => (
                  <SkillBar
                    key={skill.id}
                    {...skill}
                    index={i}
                    highlighted={(portfolioCtx?.skills?.[String(skill.id)]?.visibility ?? 'show') === 'highlight'}
                  />
                ))
            }
          </div>
        </div>
      </section>

      {/* ═══ GITHUB ═══ */}
      <section className="py-16 md:py-28 bg-snow">
        <div className="max-w-[1100px] w-full mx-auto px-6">
          <SectionHeader
            code="// 03"
            title="GitHub"
            subtitle="Open source and personal projects."
          />
          <GitHubSection compact />
        </div>
      </section>

      {/* ═══ EDUCATION & EXPERIENCE ═══ */}
      <section className="py-16 md:py-28 bg-snow">
        <div className="max-w-[700px] w-full mx-auto px-6">
          <SectionHeader
            code="// 04"
            title="Journey"
            subtitle="Education and experience so far."
          />
          <div>
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="relative pl-10 md:pl-14 pb-14 last:pb-0">
                    <div className="absolute left-0 top-0 bottom-0 w-px bg-mist" />
                    <div className="absolute left-0 top-2 w-3 h-3 rounded-full -translate-x-1/2 border-2 bg-white border-silver" />
                    <Skeleton className="h-3 w-16 mb-3" />
                    <Skeleton className="h-5 w-48 mb-2" />
                    <Skeleton className="h-3 w-32 mb-4" />
                    <Skeleton className="h-3 w-full mb-1" />
                    <Skeleton className="h-3 w-5/6" />
                  </div>
                ))
              : visibleExperience.map((item, i) => {
                  const expCtx = portfolioCtx?.experience?.[String(item.id)]
                  return (
                    <TimelineItem
                      key={item.id}
                      {...item}
                      title={expCtx?.title ?? item.title}
                      subtitle={expCtx?.subtitle ?? item.subtitle}
                      description={expCtx?.description ?? item.description}
                      note={expCtx?.note}
                      highlighted={(expCtx?.visibility ?? 'show') === 'highlight'}
                      index={i}
                    />
                  )
                })
            }
          </div>
        </div>
      </section>

      {/* ═══ CTA BANNER ═══ */}
      <section className="py-16 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue/[0.03] via-transparent to-violet/[0.03]" />
        <div className="relative max-w-[700px] w-full mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-serif text-4xl md:text-6xl italic text-ink mb-6">
              Let's build something
            </h2>
            <p className="text-steel text-base md:text-lg mb-10 max-w-md mx-auto leading-relaxed">
              Open to internships, collaborations, and interesting projects.
            </p>
            <Link
              to="/contact"
              className="group inline-flex items-center gap-3 px-8 py-4 bg-blue text-white font-mono text-sm font-semibold rounded-xl hover:bg-blue-dim transition-colors shadow-lg shadow-blue/20"
            >
              Start a Conversation
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </section>
    </>
  )
}
