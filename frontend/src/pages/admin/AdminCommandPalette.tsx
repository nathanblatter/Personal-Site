import { useState, useEffect, useMemo, useRef } from 'react'
import { Search, CornerDownLeft } from 'lucide-react'
import { ADMIN_THEMES } from '../../lib/adminThemes'

interface Command {
  id: string
  label: string
  group: string
  run: () => void
}

export default function AdminCommandPalette({
  sections, onNavigate, onSetTheme, onLogout,
}: {
  sections: { id: string; label: string }[]
  onNavigate: (id: string) => void
  onSetTheme: (id: string) => void
  onLogout: () => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Global ⌘K / Ctrl+K toggle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) { setQuery(''); setActive(0); setTimeout(() => inputRef.current?.focus(), 0) }
  }, [open])

  const commands = useMemo<Command[]>(() => {
    const close = (fn: () => void) => () => { fn(); setOpen(false) }
    const nav: Command[] = sections.map(s => ({
      id: `go-${s.id}`, label: `Go to ${s.label}`, group: 'Navigate', run: close(() => onNavigate(s.id)),
    }))
    const quick: Command[] = [
      { id: 'new-post', label: 'New blog post', group: 'Actions', run: close(() => onNavigate('blog')) },
      { id: 'new-invoice', label: 'New invoice', group: 'Actions', run: close(() => onNavigate('consulting')) },
      { id: 'find-contact', label: 'Find a contact', group: 'Actions', run: close(() => onNavigate('consulting')) },
      { id: 'view-site', label: 'View live site', group: 'Actions', run: close(() => window.open('/', '_blank')) },
      { id: 'logout', label: 'Log out', group: 'Actions', run: close(onLogout) },
    ]
    const themes: Command[] = ADMIN_THEMES.map(t => ({
      id: `theme-${t.id}`, label: `Theme: ${t.name}`, group: 'Theme', run: close(() => onSetTheme(t.id)),
    }))
    return [...nav, ...quick, ...themes]
  }, [sections, onNavigate, onSetTheme, onLogout])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter(c => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q))
  }, [commands, query])

  useEffect(() => { setActive(0) }, [query])

  if (!open) return null

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); filtered[active]?.run() }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[15vh] px-4" onClick={() => setOpen(false)}>
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white border border-mist rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 border-b border-mist">
          <Search size={16} className="text-steel shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search sections, actions, themes…"
            className="flex-1 py-3.5 bg-transparent text-sm text-ink placeholder-silver focus:outline-none"
          />
          <kbd className="font-mono text-[10px] text-silver border border-mist rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-steel py-8 font-mono">No matches</p>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                onMouseEnter={() => setActive(i)}
                onClick={cmd.run}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  i === active ? 'bg-blue-wash text-blue' : 'text-slate hover:bg-cloud'
                }`}
              >
                <span>{cmd.label}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-[10px] text-silver uppercase tracking-wider">{cmd.group}</span>
                  {i === active && <CornerDownLeft size={12} className="text-blue" />}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
