import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { Download } from 'lucide-react'
import { api, type ExperienceResponse, type SkillResponse, type ProjectResponse, type AboutResponse, type CourseworkResponse } from '../lib/api'

export default function Resume() {
  const [about, setAbout] = useState<AboutResponse | null>(null)
  const [experience, setExperience] = useState<ExperienceResponse[]>([])
  const [skills, setSkills] = useState<SkillResponse[]>([])
  const [projects, setProjects] = useState<ProjectResponse[]>([])
  const [coursework, setCoursework] = useState<CourseworkResponse[]>([])

  useEffect(() => {
    Promise.all([
      api.about.get(),
      api.experience.list(),
      api.skills.list(),
      api.projects.list(),
      api.coursework.list(),
    ]).then(([ab, ex, sk, pr, cw]) => {
      setAbout(ab)
      setExperience(ex)
      setSkills(sk)
      setProjects(pr.filter(p => p.status === 'live').slice(0, 5))
      setCoursework(cw)
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
              <div key={i} className="h-4 bg-cloud rounded animate-pulse" style={{ width: `${70 + Math.random() * 30}%` }} />
            ))}
          </div>
        </div>
      </>
    )
  }

  const skillsByCategory = skills.reduce<Record<string, string[]>>((acc, s) => {
    acc[s.category] = acc[s.category] || []
    acc[s.category].push(s.name)
    return acc
  }, {})

  // Merge BI into Data
  if (skillsByCategory['BI'] && skillsByCategory['Data']) {
    skillsByCategory['Data'] = [...skillsByCategory['Data'], ...skillsByCategory['BI']]
    delete skillsByCategory['BI']
  }

  const categoryLabels: Record<string, string> = {
    Data: 'Data & BI', Lang: 'Systems Development', Web: 'Web Development',
    Front: 'Frontend', Back: 'Backend', Cloud: 'Cloud & Infrastructure',
  }

  const edu = experience.find(e => e.title.includes('B.S.') || e.title.includes('Bachelor'))
  const jobs = experience.filter(e => e !== edu)

  return (
    <>
      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-[850px] mx-auto px-6 pt-8 pb-4 flex items-center justify-between print:hidden"
      >
        <h1 className="font-mono text-xs text-steel uppercase tracking-wider">Resume</h1>
        <a
          href="/resume.pdf"
          target="_blank"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors"
        >
          <Download size={13} /> Download PDF
        </a>
      </motion.div>

      {/* Resume */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="max-w-[850px] mx-auto px-6 pb-16 print:max-w-none print:px-0 print:pb-0"
      >
        <div className="bg-white border border-mist rounded-2xl px-12 py-10 print:border-0 print:rounded-none print:px-8 print:py-4 print:shadow-none resume-body text-[11.5px] leading-[1.55] text-[#1a1a2e]">

          {/* ── HEADER ── */}
          <div className="text-center mb-1">
            <h1 className="text-[20px] font-bold tracking-wide">Nathan Blatter</h1>
            <p className="text-[10.5px] text-[#555] mt-0.5">
              nzb22@byu.edu | nathanblatter.com | linkedin.com/in/nathanblatter | github.com/nathanblatter
            </p>
          </div>

          {/* ── SUMMARY ── */}
          <p className="text-[10.5px] leading-[1.6] mt-2.5 mb-3 text-justify">
            <span className="font-bold">Information Systems student (Full-Stack Software Engineering emphasis)</span> with experience in C#, Java, Python, SQL, and cloud platforms, complemented by a background in SCM, ERP, and AI-driven systems. Proven ability to build full-stack analytics and intelligent applications, including a voice-enabled AI platform deployed for clinical research. Known for strong ownership, clean code practices, and delivering measurable technical impact in collaborative team environments.
          </p>

          {/* ── EDUCATION ── */}
          <Section title="education">
            {edu && (
              <>
                <Row
                  left={<span className="font-bold">{edu.title}</span>}
                  right={edu.year}
                />
                <p className="text-[10.5px] text-[#555]">Data Analytics Focus, STEM-Designated Program</p>
                <p className="text-[10.5px] text-[#555]">{edu.subtitle}</p>
                {about.gpa && <p className="text-[10.5px]">GPA: {about.gpa}</p>}
                <p className="text-[10.5px]">Member of the Association for Information Systems</p>
                {coursework.length > 0 && (
                  <p className="text-[10.5px] mt-0.5">
                    <span className="font-bold">Relevant Coursework:</span> {coursework.map(c => c.name).join(', ')}
                  </p>
                )}
              </>
            )}
          </Section>

          {/* ── TECHNICAL SKILLS ── */}
          <Section title="technical skills">
            {Object.entries(skillsByCategory).map(([cat, names]) => (
              <p key={cat} className="text-[10.5px]">
                <span className="font-bold">{categoryLabels[cat] || cat}:</span> {names.join(', ')}
              </p>
            ))}
          </Section>

          {/* ── PROJECTS ── */}
          <Section title="Projects">
            <div className="space-y-1.5">
              {projects.map(project => {
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
                    <Bullets text={project.description} />
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
                  <p className="text-[10.5px] text-[#555] italic">{job.subtitle}</p>
                  <Bullets text={job.description} />
                </div>
              ))}
            </div>
          </Section>

          {/* ── OTHER ── */}
          <Section title="Other Achievements">
            <Bullets text={[
              'Passionate about advancing mental health access through AI-powered therapy and research',
              about.bio_paragraphs[2] || '',
            ].filter(Boolean).join('\n')} />
          </Section>

        </div>
      </motion.div>

    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 print:mt-2">
      <h2 className="text-[12px] font-bold lowercase border-b border-[#1a1a2e]/30 pb-px mb-1.5 print:mb-1">{title}</h2>
      {children}
    </div>
  )
}

function Row({ left, right }: { left: React.ReactNode; right: string }) {
  return (
    <div className="flex justify-between items-baseline">
      <div className="text-[11.5px]">{left}</div>
      <span className="text-[10.5px] text-[#555] shrink-0 ml-4">{right}</span>
    </div>
  )
}

function Bullets({ text }: { text: string }) {
  const lines = text.split('\n').map(l => l.replace(/^[•\-]\s*/, '').trim()).filter(Boolean)
  return (
    <div className="mt-0.5">
      {lines.map((line, i) => (
        <p key={i} className="text-[10.5px] leading-[1.55] pl-2.5 relative before:content-['•'] before:absolute before:left-0 before:text-[#555]">
          {line}
        </p>
      ))}
    </div>
  )
}
