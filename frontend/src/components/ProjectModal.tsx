import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { X, ArrowUpRight, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Project } from './ProjectCard'

interface Props {
  project: Project | null
  onClose: () => void
}

export default function ProjectModal({ project, onClose }: Props) {
  const [imgIdx, setImgIdx] = useState(0)
  const images = project?.images ?? []
  const modalRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Body scroll lock
  useEffect(() => {
    if (!project) return
    previousFocusRef.current = document.activeElement as HTMLElement
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [project])

  // Focus trap
  const trapFocus = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !modalRef.current) return
    const focusable = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus()
    }
  }, [])

  useEffect(() => {
    if (!project) return
    setImgIdx(0)
    // Focus the modal
    setTimeout(() => modalRef.current?.focus(), 0)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setImgIdx(i => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setImgIdx(i => Math.min((project.images?.length ?? 1) - 1, i + 1))
      trapFocus(e)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previousFocusRef.current?.focus()
    }
  }, [project, onClose, trapFocus])

  const statusColors: Record<string, string> = {
    live: 'bg-teal',
    wip: 'bg-blue',
    archived: 'bg-silver',
  }

  return (
    <AnimatePresence>
      {project && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-label={project.title}
              tabIndex={-1}
              className="relative w-full max-w-lg bg-white rounded-2xl border border-mist shadow-2xl pointer-events-auto overflow-hidden max-h-[90vh] overflow-y-auto focus:outline-none"
            >
              <div className="p-7 md:p-8">
                {/* Header row */}
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${statusColors[project.status]}`} />
                    <span className="font-mono text-xs text-steel uppercase tracking-wider">
                      {project.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-xs text-silver">{project.year}</span>
                    <button
                      onClick={onClose}
                      className="text-silver hover:text-ink transition-colors"
                      aria-label="Close"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-2xl font-sans font-semibold text-ink mb-5">
                  {project.title}
                </h3>

                {/* Full description */}
                <p className="text-steel text-sm leading-relaxed mb-6">
                  {project.description}
                </p>

                {/* Metrics */}
                {project.metrics && project.metrics.length > 0 && (
                  <div className="flex flex-wrap gap-4 mb-6">
                    {project.metrics.map((m, i) => (
                      <div key={i} className="flex-1 min-w-[100px] p-3 rounded-lg bg-cloud border border-mist text-center">
                        <div className="text-lg font-semibold text-blue">{m.value}</div>
                        <div className="font-mono text-[10px] text-steel uppercase tracking-wider mt-0.5">{m.label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Image gallery */}
                {images.length > 0 && (
                  <div className="relative mb-6 rounded-lg overflow-hidden border border-mist" aria-live="polite">
                    <img
                      src={images[imgIdx]}
                      alt={`${project.title} screenshot ${imgIdx + 1} of ${images.length}`}
                      loading="lazy"
                      decoding="async"
                      className="w-full object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                    />
                    {images.length > 1 && (
                      <>
                        <button
                          onClick={() => setImgIdx(i => Math.max(0, i - 1))}
                          disabled={imgIdx === 0}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-ink/70 text-white rounded-full flex items-center justify-center hover:bg-ink/90 transition-colors disabled:opacity-0 shadow-lg"
                        >
                          <ChevronLeft size={18} />
                        </button>
                        <button
                          onClick={() => setImgIdx(i => Math.min(images.length - 1, i + 1))}
                          disabled={imgIdx === images.length - 1}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-ink/70 text-white rounded-full flex items-center justify-center hover:bg-ink/90 transition-colors disabled:opacity-0 shadow-lg"
                        >
                          <ChevronRight size={18} />
                        </button>
                        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-2 bg-ink/50 backdrop-blur rounded-full px-3 py-1.5">
                          {images.map((_, i) => (
                            <button
                              key={i}
                              onClick={() => setImgIdx(i)}
                              className={`w-2.5 h-2.5 rounded-full transition-all ${i === imgIdx ? 'bg-white scale-110' : 'bg-white/40 hover:bg-white/70'}`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Tags */}
                <div className="flex flex-wrap gap-2 mb-7">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="font-mono text-[11px] px-3 py-1.5 rounded-full bg-cloud text-slate"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Links */}
                <div className="flex items-center gap-5">
                  {project.project_id && (
                    <Link
                      to={`/projects/${project.project_id}`}
                      onClick={onClose}
                      className="inline-flex items-center gap-2 font-mono text-xs text-blue hover:text-blue-dim transition-colors"
                    >
                      Read the case study
                      <ArrowRight size={12} />
                    </Link>
                  )}
                  {project.link && (
                    <a
                      href={project.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 font-mono text-xs text-steel hover:text-ink transition-colors"
                    >
                      View Live
                      <ArrowUpRight size={12} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
