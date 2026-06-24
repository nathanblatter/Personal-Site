import { motion } from 'motion/react'
import { FolderKanban, BarChart3 } from 'lucide-react'
import type { ProjectResponse, SkillResponse, ExperienceResponse, CourseworkResponse } from '../../lib/api'
import { StatusBadge, SectionCard } from './AdminShared'

interface OverviewSectionProps {
  projects: ProjectResponse[]
  skills: SkillResponse[]
  experience: ExperienceResponse[]
  coursework: CourseworkResponse[]
}

export default function OverviewSection({ projects, skills, experience, coursework }: OverviewSectionProps) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div>
        <h2 className="text-2xl font-sans font-semibold text-ink mb-1">Dashboard</h2>
        <p className="text-steel text-sm">Manage your portfolio content. All changes persist to the database.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
}
