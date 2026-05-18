import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import SectionHeader from '../components/SectionHeader'
import ProjectCard from '../components/ProjectCard'
import ProjectModal from '../components/ProjectModal'
import Skeleton from '../components/Skeleton'
import { api, type ProjectResponse } from '../lib/api'
import type { Project } from '../components/ProjectCard'

const categories = ['All', 'Live', 'WIP', 'Archived']

export default function Projects() {
  const [allProjects, setAllProjects] = useState<ProjectResponse[]>([])
  const [filter, setFilter] = useState('All')
  const [selected, setSelected] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.projects.list().then(setAllProjects).finally(() => setLoading(false))
  }, [])

  const filtered =
    filter === 'All'
      ? allProjects
      : allProjects.filter((p) => p.status === filter.toLowerCase())

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
                  ? allProjects.length
                  : allProjects.filter((p) => p.status === cat.toLowerCase()).length}
              </span>
            </button>
          ))}
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-7">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
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
            : filtered.map((project, i) => (
                <ProjectCard key={project.id} project={project} index={i} onSelect={setSelected} />
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
