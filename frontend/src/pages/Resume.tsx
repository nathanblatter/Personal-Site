import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { Download } from 'lucide-react'
import { useDocumentMeta } from '../lib/useDocumentMeta'
import { api, type ExperienceResponse, type SkillResponse, type ProjectResponse, type AboutResponse, type CourseworkResponse, type ResumeVariantResponse, type ResumeExtras } from '../lib/api'

export default function Resume() {
  const [about, setAbout] = useState<AboutResponse | null>(null)
  const [experience, setExperience] = useState<ExperienceResponse[]>([])
  const [skills, setSkills] = useState<SkillResponse[]>([])
  const [projects, setProjects] = useState<ProjectResponse[]>([])
  const [coursework, setCoursework] = useState<CourseworkResponse[]>([])
  const [variants, setVariants] = useState<ResumeVariantResponse[]>([])
  const [extras, setExtras] = useState<ResumeExtras>({})
  const [activeKey, setActiveKey] = useState<string | null>(null)

  useDocumentMeta({
    title: 'Résumé — Nathan Blatter',
    description: 'Résumé of Nathan Blatter — full-stack software engineer and Information Systems student at BYU.',
    canonical: '/resume',
  })

  useEffect(() => {
    api.resume.data().then(({ about: ab, experience: ex, skills: sk, projects: pr, coursework: cw, variants: vs, extras: xt }) => {
      setAbout(ab)
      setExperience(ex.filter(e => e.on_resume !== false))
      setExtras(xt ?? {})
      setSkills(sk)
      setProjects(pr.filter(p => p.status === 'live'))
      setCoursework(cw)
      const list = vs ?? []
      setVariants(list)
      setActiveKey((list.find(v => v.is_default) ?? list[0])?.key ?? null)
    })
  }, [])

  if (!about) {
    return (
      <>
        <div className="max-w-[850px] mx-auto px-6 pt-8 pb-4 flex items-center justify-between print:hidden">
          <h1 className="font-mono text-xs text-steel uppercase tracking-wider">Resume</h1>
          <a
            href="/resume.pdf"
            target="_blank"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors"
          >
            <Download size={13} /> Download PDF
          </a>
        </div>
        <div className="max-w-[850px] mx-auto px-6 pb-16">
          <div className="bg-white border border-mist rounded-2xl px-12 py-10 space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-4 bg-cloud rounded animate-pulse" style={{ width: `${70 + ((i * 37) % 30)}%` }} />
            ))}
          </div>
        </div>
      </>
    )
  }

  // Collapse the site's granular skill categories into the résumé's four lines
  // (same grouping as backend/app/resume_skills.py so the PDF matches the page).
  const groups: [string, string[]][] = [
    ['Data & BI', ['Data', 'BI']],
    ['Systems Development', ['Backend', 'Lang', 'Back']],
    ['Web Development', ['Web', 'Frontend', 'Front']],
    ['Cloud & Infrastructure', ['Cloud']],
  ]
  const grouped = groups
    .map(([label, cats]) => [label, skills.filter(s => cats.includes(s.category)).map(s => s.name)] as [string, string[]])
    .filter(([, names]) => names.length > 0)
  const known = new Set(groups.flatMap(([, cats]) => cats))
  for (const s of skills) {
    if (known.has(s.category)) continue
    const row = grouped.find(([label]) => label === s.category)
    if (row) row[1].push(s.name)
    else grouped.push([s.category, [s.name]])
  }

  const degrees = experience.filter(e => e.kind === 'education')
  const jobs = experience.filter(e => e.kind !== 'education')

  const activeVariant = variants.find(v => v.key === activeKey) ?? null
  const pdfHref = activeVariant ? `/resume.pdf?variant=${activeVariant.key}` : '/resume.pdf'

  // Surface projects matching the active variant's emphasis tags first, then take 4 (one-page résumé).
  const emphasis = new Set((activeVariant?.emphasis_tags ?? []).map(t => t.toLowerCase()))
  const displayProjects = (emphasis.size === 0
    ? projects
    : [...projects].sort((a, b) => {
        const am = a.tags.some(t => emphasis.has(t.toLowerCase())) ? 0 : 1
        const bm = b.tags.some(t => emphasis.has(t.toLowerCase())) ? 0 : 1
        return am - bm
      })
  ).slice(0, 4)

  return (
    <>
      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-[850px] mx-auto px-6 pt-8 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:hidden"
      >
        {variants.length > 1 ? (
          <div className="flex items-center gap-1.5 flex-wrap" role="tablist" aria-label="Résumé focus">
            {variants.map(v => (
              <button
                key={v.key}
                role="tab"
                aria-selected={v.key === activeKey}
                onClick={() => setActiveKey(v.key)}
                className={`font-mono text-[11px] px-3 py-1.5 rounded-lg transition-all ${
                  v.key === activeKey
                    ? 'bg-ink text-white'
                    : 'bg-white border border-mist text-steel hover:text-blue hover:border-blue/30'
                }`}
                title={v.headline}
              >
                {v.label}
              </button>
            ))}
          </div>
        ) : (
          <h1 className="font-mono text-xs text-steel uppercase tracking-wider">Resume</h1>
        )}
        <a
          href={pdfHref}
          target="_blank"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors shrink-0"
        >
          <Download size={13} /> Download{activeVariant ? ` · ${activeVariant.label}` : ''} PDF
        </a>
      </motion.div>

      {/* Resume */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="max-w-[850px] mx-auto px-6 pb-16 print:max-w-none print:px-0 print:pb-0"
      >
        <div className="bg-white border border-mist rounded-2xl px-12 py-10 print:border-0 print:rounded-none print:px-8 print:py-4 print:shadow-none resume-body text-[11.5px] leading-[1.55] text-ink print:text-[#1a1a2e]">

          {/* ── HEADER ── */}
          <div className="text-center mb-1">
            <h1 className="text-[20px] font-bold tracking-wide">Nathan Blatter</h1>
            <p className="text-[10.5px] text-slate mt-0.5">
              nzb22@byu.edu | nathanblatter.com | linkedin.com/in/nathanblatter | github.com/nathanblatter
            </p>
          </div>

          {/* ── SUMMARY (variant-aware) ── */}
          <p className="text-[10.5px] leading-[1.6] mt-2.5 mb-3 text-justify">
            {activeVariant ? (
              <><span className="font-bold">{activeVariant.headline}</span> {activeVariant.summary}</>
            ) : (
              <><span className="font-bold">Information Systems student (Full-Stack Software Engineering emphasis)</span> with experience in Python, Go, C#, PHP, SQL, and cloud platforms, complemented by a background in SCM, ERP, and AI-driven systems. Proven ability to build full-stack analytics and intelligent applications, including a voice-enabled AI platform deployed for clinical research. Known for strong ownership, clean code practices, and delivering measurable technical impact in collaborative team environments.</>
            )}
          </p>

          {/* ── EDUCATION ── */}
          <Section title="education">
            <div className="space-y-1.5">
              {degrees.map((edu, i) => (
                <div key={edu.id}>
                  <Row
                    left={<span className="font-bold">{edu.title}</span>}
                    right={edu.year}
                  />
                  <p className="text-[10.5px] text-slate">{edu.subtitle}</p>
                  {descLines(edu.description).map((line, j) => (
                    <p key={j} className="text-[10.5px] text-slate">{line}</p>
                  ))}
                  {i === 0 && about.gpa && <p className="text-[10.5px]">GPA: {about.gpa}</p>}
                  {i === 0 && coursework.length > 0 && (
                    <p className="text-[10.5px] mt-0.5">
                      <span className="font-bold">Relevant Coursework:</span> {coursework.map(c => c.name).join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Section>

          {/* ── TECHNICAL SKILLS ── */}
          <Section title="technical skills">
            {grouped.map(([label, names]) => (
              <p key={label} className="text-[10.5px]">
                <span className="font-bold">{label}:</span> {names.join(', ')}
              </p>
            ))}
          </Section>

          {/* ── PROJECTS ── */}
          <Section title="Projects">
            <div className="space-y-1.5">
              {displayProjects.map(project => {
                const hrs = project.metrics?.find(m => m.label.toLowerCase().includes('hr'))
                return (
                  <div key={project.id}>
                    <p>
                      <span className="font-bold">{project.title}</span>
                      <span className="text-[10.5px]"> ({project.tags.slice(0, 5).join(', ')})</span>
                      <span className="text-[10.5px]"> | {project.year}</span>
                      {hrs && <span className="text-[10.5px]"> | {hrs.value} hrs</span>}
                      {project.link && (
                        <span className="text-[10.5px]"> | <a href={project.link} target="_blank" rel="noopener noreferrer" className="text-blue hover:underline print:text-[#1a1a2e] print:no-underline">Link</a></span>
                      )}
                    </p>
                    <Bullets text={project.summary || project.description} />
                  </div>
                )
              })}
            </div>
          </Section>

          {/* ── EXPERIENCE ── */}
          <Section title="Experience">
            <div className="space-y-2.5">
              {jobs.map(job => (
                <div key={job.id}>
                  <Row
                    left={<span className="font-bold">{job.title}</span>}
                    right={job.year}
                  />
                  <p className="text-[10.5px] text-slate italic">{job.subtitle}</p>
                  <Bullets text={job.description} />
                </div>
              ))}
            </div>
          </Section>

          {/* ── OTHER ── */}
          <Section title="Other Achievements">
            <Bullets text={(extras.achievements?.length
              ? extras.achievements
              : ['Passionate about advancing mental health access through AI-powered therapy and research', about.bio_paragraphs[2] || '']
            ).filter(Boolean).join('\n')} />
          </Section>

        </div>
      </motion.div>

    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 print:mt-2">
      <h2 className="text-[12px] font-bold lowercase border-b border-ink/30 pb-px mb-1.5 print:mb-1">{title}</h2>
      {children}
    </div>
  )
}

function Row({ left, right }: { left: React.ReactNode; right: string }) {
  return (
    <div className="flex justify-between items-baseline">
      <div className="text-[11.5px]">{left}</div>
      <span className="text-[10.5px] text-slate shrink-0 ml-4">{right}</span>
    </div>
  )
}

function descLines(text: string): string[] {
  return text.split('\n').map(l => l.replace(/^[•-]\s*/, '').trim()).filter(Boolean)
}

function Bullets({ text }: { text: string }) {
  const lines = descLines(text)
  return (
    <div className="mt-0.5">
      {lines.map((line, i) => (
        <p key={i} className="text-[10.5px] leading-[1.55] pl-2.5 relative before:content-['•'] before:absolute before:left-0 before:text-slate">
          {line}
        </p>
      ))}
    </div>
  )
}
