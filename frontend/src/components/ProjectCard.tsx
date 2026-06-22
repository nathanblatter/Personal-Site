import { motion } from 'motion/react'
import { ArrowUpRight } from 'lucide-react'

export interface Project {
  id: string | number
  project_id?: string
  title: string
  description: string
  tags: string[]
  year: string
  color: string
  status: 'live' | 'wip' | 'archived'
  link?: string
  images?: string[]
  metrics?: { label: string; value: string }[]
}

export default function ProjectCard({
  project,
  index,
  onSelect,
  highlighted,
}: {
  project: Project
  index: number
  onSelect?: (project: Project) => void
  highlighted?: boolean
}) {
  const statusColors = {
    live: 'bg-teal',
    wip: 'bg-blue',
    archived: 'bg-silver',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="group relative cursor-pointer"
      onClick={() => onSelect?.(project)}
    >
      <div className={`relative overflow-hidden rounded-xl border bg-white hover:border-blue/30 transition-all duration-500 hover:shadow-lg hover:shadow-blue/5 ${highlighted ? 'border-blue/40 ring-2 ring-blue/20' : 'border-mist'}`}>
        {/* Colored accent bar */}
        <div className="h-1.5 w-full" style={{ background: project.color }} />

        <div className="p-7 md:p-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${statusColors[project.status]}`} />
              <span className="font-mono text-xs text-steel uppercase tracking-wider">
                {project.status}
              </span>
            </div>
            <span className="font-mono text-xs text-silver">{project.year}</span>
          </div>

          {/* Title */}
          <h3 className="text-xl font-sans font-semibold text-ink mb-4 group-hover:text-blue transition-colors">
            {project.title}
            <ArrowUpRight
              size={16}
              className="inline-block ml-2 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1 group-hover:-translate-y-1"
            />
          </h3>

          {/* Description */}
          <p className="text-steel text-sm leading-relaxed mb-7 line-clamp-3">
            {project.description}
          </p>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className="font-mono text-[11px] px-3 py-1.5 rounded-full bg-cloud text-slate hover:bg-blue-wash hover:text-blue transition-colors"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Live link */}
          {project.link && (
            <a
              href={project.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-2 mt-6 font-mono text-xs text-blue hover:text-blue-dim transition-colors"
            >
              View Live
              <ArrowUpRight size={12} />
            </a>
          )}
        </div>
      </div>
    </motion.div>
  )
}
