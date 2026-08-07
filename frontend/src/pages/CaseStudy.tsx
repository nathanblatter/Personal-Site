import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { api, type ProjectResponse } from '../lib/api'
import Skeleton from '../components/Skeleton'
import { useDocumentMeta } from '../lib/useDocumentMeta'

const statusColors: Record<string, string> = {
  live: 'bg-teal',
  wip: 'bg-blue',
  archived: 'bg-silver',
}

export default function CaseStudy() {
  const { projectId } = useParams<{ projectId: string }>()
  const [project, setProject] = useState<ProjectResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  useDocumentMeta({
    title: project ? `${project.title} — Nathan Blatter` : undefined,
    description: project?.description || undefined,
    canonical: projectId ? `/projects/${projectId}` : undefined,
    ogImage: project?.images?.[0] || undefined,
  })

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    api.projects.list()
      .then(list => {
        if (cancelled) return
        setProject(list.find(p => p.project_id === projectId) ?? null)
      })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [projectId, retryKey])

  if (loading) {
    return (
      <section className="py-12 md:py-20 min-h-screen">
        <div className="max-w-[820px] w-full mx-auto px-6">
          <Skeleton className="h-4 w-28 mb-10" />
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="h-12 w-3/4 mb-6" />
          <Skeleton className="h-1.5 w-24 rounded-full mb-8" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-12">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      </section>
    )
  }

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

  if (!project) {
    return (
      <section className="py-24 min-h-screen">
        <div className="max-w-[820px] mx-auto px-6 text-center">
          <p className="font-mono text-sm text-steel mb-4">Project not found.</p>
          <Link to="/projects" className="font-mono text-xs text-blue hover:underline">
            ← Back to projects
          </Link>
        </div>
      </section>
    )
  }

  const paragraphs = project.description.split(/\n{2,}/).filter(Boolean)

  return (
    <section className="py-12 md:py-20 min-h-screen">
      <div className="max-w-[820px] w-full mx-auto px-6">
        <Link
          to="/projects"
          className="inline-flex items-center gap-2 font-mono text-xs text-steel hover:text-blue transition-colors mb-10"
        >
          <ArrowLeft size={13} /> All projects
        </Link>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Meta row */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2.5">
              <div className={`w-2 h-2 rounded-full ${statusColors[project.status]}`} />
              <span className="font-mono text-xs text-steel uppercase tracking-wider">{project.status}</span>
            </div>
            <span className="font-mono text-xs text-silver">{project.year}</span>
          </div>

          <h1 className="font-serif text-4xl md:text-5xl italic text-ink mb-6">{project.title}</h1>

          {/* Accent bar */}
          <div className="h-1.5 w-24 rounded-full mb-8" style={{ background: project.color }} />
        </motion.div>

        {/* Metrics */}
        {project.metrics && project.metrics.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-12"
          >
            {project.metrics.map((m, i) => (
              <div key={i} className="p-4 rounded-xl bg-cloud border border-mist text-center">
                <div className="text-2xl font-semibold text-blue">{m.value}</div>
                <div className="font-mono text-[10px] text-steel uppercase tracking-wider mt-1">{m.label}</div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Write-up */}
        <div className="prose-custom space-y-5 text-steel leading-relaxed text-[15px] mb-12">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        {/* Image gallery */}
        {project.images && project.images.length > 0 && (
          <div className="space-y-6 mb-12">
            {project.images.map((src, i) => (
              <img
                key={i}
                src={src}
                alt={`${project.title} — ${i + 1}`}
                loading="lazy"
                decoding="async"
                className="w-full rounded-xl border border-mist"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
            ))}
          </div>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-12">
          {project.tags.map(tag => (
            <span key={tag} className="font-mono text-[11px] px-3 py-1.5 rounded-full bg-cloud text-slate">
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
            className="inline-flex items-center gap-2 font-mono text-sm text-blue hover:text-blue-dim transition-colors mb-14"
          >
            View it live <ArrowUpRight size={14} />
          </a>
        )}

        {/* CTA */}
        <div className="mt-4 rounded-2xl border border-mist bg-snow p-8 text-center">
          <h2 className="font-sans font-semibold text-ink text-xl mb-2">Have a project like this?</h2>
          <p className="text-steel text-sm mb-5 max-w-md mx-auto">
            I take on a small number of consulting engagements. If this is the kind of work you need,
            let's talk.
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue text-white font-mono text-xs tracking-wider hover:bg-blue-dim transition-colors"
          >
            Get in touch <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>
    </section>
  )
}
