import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import SectionHeader from '../components/SectionHeader'
import ProjectCard from '../components/ProjectCard'
import ProjectModal from '../components/ProjectModal'
import ProjectCardSkeleton from '../components/ProjectCardSkeleton'
import { api, type ProjectResponse } from '../lib/api'
import { usePortfolioCtx } from '../lib/usePortfolioCtx'
import type { Project } from '../components/ProjectCard'

const categories = ['All', 'Live', 'WIP', 'Archived']

export default function Projects() {
  const [allProjects, setAllProjects] = useState<ProjectResponse[]>([])
  const [filter, setFilter] = useState('All')
  const [selected, setSelected] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const portfolioCtx = usePortfolioCtx()

  useEffect(() => {
    setLoading(true)
    setError(false)
    api.projects.list().then(setAllProjects).catch(() => setError(true)).finally(() => setLoading(false))
  }, [retryKey])

  const visibleProjects = portfolioCtx
    ? allProjects.filter(p => (portfolioCtx.projects?.[p.project_id]?.visibility ?? 'show') !== 'hide')
    : allProjects

  const filtered =
    filter === 'All'
      ? visibleProjects
      : visibleProjects.filter((p) => p.status === filter.toLowerCase())

  if (error) {
    return (
      <section className="py-24 min-h-screen flex items-center justify-center">
        <div className="text-center text-steel">
          <p className="font-mono text-sm mb-2">Couldn't load this page.</p>
          <button
            onClick={() => setRetryKey(k => k + 1)}
            className="font-mono text-xs text-blue hover:underline underline-offset-2 mt-1"
          >
            Retry
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="py-16 md:py-28 min-h-screen">
      <div className="max-w-[1100px] w-full mx-auto px-6">
        <SectionHeader
          code="// PROJECTS"
          title="All Work"
          subtitle="A collection of research, professional, and personal projects."
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap justify-center gap-2 md:gap-3 mb-10 md:mb-12"
        >
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`font-mono text-xs px-4 md:px-5 py-2 md:py-2.5 rounded-full border transition-all ${
                filter === cat
                  ? 'border-blue text-blue bg-blue-wash'
                  : 'border-mist text-steel hover:border-silver hover:text-ink'
              }`}
            >
              {cat}
              <span className="ml-2 text-silver">
                {cat === 'All'
                  ? visibleProjects.length
                  : visibleProjects.filter((p) => p.status === cat.toLowerCase()).length}
              </span>
            </button>
          ))}
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-7">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <ProjectCardSkeleton key={i} />)
            : filtered.map((project, i) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  index={i}
                  onSelect={setSelected}
                  highlighted={(portfolioCtx?.projects?.[project.project_id]?.visibility ?? 'show') === 'highlight'}
                />
              ))
          }
        </div>

        {!loading && filtered.length === 0 && (
          <div className="text-center py-24">
            <p className="font-mono text-sm text-steel">No projects in this category yet.</p>
          </div>
        )}
      </div>

      <ProjectModal project={selected} onClose={() => setSelected(null)} />
    </section>
  )
}
