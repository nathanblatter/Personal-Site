import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Search, FileText, FolderKanban, File, CornerDownLeft, Loader2 } from 'lucide-react'
import { api, type SearchResult } from '../lib/api'

const TYPE_META: Record<SearchResult['type'], { icon: typeof FileText; label: string }> = {
  blog: { icon: FileText, label: 'Post' },
  project: { icon: FolderKanban, label: 'Project' },
  page: { icon: File, label: 'Page' },
}

export default function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
    setQ('')
    setResults([])
    setActive(0)
  }, [open])

  useEffect(() => {
    if (!open) return
    const term = q.trim()
    if (term.length < 2) { setResults([]); setLoading(false); return }
    setLoading(true)
    const h = setTimeout(async () => {
      try {
        const { results: res } = await api.search(term)
        setResults(res)
        setActive(0)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 180)
    return () => clearTimeout(h)
  }, [q, open])

  const go = useCallback((r: SearchResult) => {
    onClose()
    if (r.url.startsWith('/')) navigate(r.url)
    else window.location.href = r.url
  }, [navigate, onClose])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter' && results[active]) { e.preventDefault(); go(results[active]) }
    else if (e.key === 'Escape') { onClose() }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-start justify-center pt-[12vh] px-4 bg-ink/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            role="dialog"
            aria-label="Site search"
            className="w-full max-w-xl bg-white border border-mist rounded-2xl shadow-2xl shadow-ink/10 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 border-b border-mist">
              <Search size={16} className="text-steel shrink-0" />
              <input
                ref={inputRef}
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search projects, posts, pages…"
                className="flex-1 py-4 bg-transparent text-ink placeholder:text-silver focus:outline-none text-[15px]"
              />
              {loading && <Loader2 size={15} className="text-steel animate-spin shrink-0" />}
              <kbd className="hidden sm:block font-mono text-[10px] text-steel border border-mist rounded px-1.5 py-0.5 shrink-0">ESC</kbd>
            </div>

            <div className="max-h-[55vh] overflow-y-auto">
              {results.map((r, i) => {
                const meta = TYPE_META[r.type]
                const Icon = meta.icon
                return (
                  <button
                    key={`${r.type}-${r.url}`}
                    onClick={() => go(r)}
                    onMouseEnter={() => setActive(i)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      i === active ? 'bg-blue-wash' : 'hover:bg-cloud'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${i === active ? 'bg-blue/10 text-blue' : 'bg-cloud text-steel'}`}>
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-ink truncate">{r.title}</span>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-steel border border-mist rounded px-1 py-px shrink-0">{meta.label}</span>
                      </div>
                      {r.subtitle && <p className="text-xs text-steel truncate mt-0.5">{r.subtitle}</p>}
                    </div>
                    {i === active && <CornerDownLeft size={13} className="text-blue shrink-0" />}
                  </button>
                )
              })}

              {!loading && q.trim().length >= 2 && results.length === 0 && (
                <p className="text-center text-steel text-sm py-10 font-mono">No results for “{q.trim()}”</p>
              )}
              {q.trim().length < 2 && (
                <p className="text-center text-silver text-xs py-10 font-mono">Type to search projects, blog posts, and pages</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
