import { useEffect, useRef, useState } from 'react'
import { Palette, Check } from 'lucide-react'
import { ADMIN_THEMES } from '../../lib/adminThemes'

export default function AdminThemePicker({
  themeId, setTheme,
}: {
  themeId: string
  setTheme: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const current = ADMIN_THEMES.find(t => t.id === themeId) ?? ADMIN_THEMES[0]
  const rootRef = useRef<HTMLDivElement>(null)

  // Close on Escape and on any pointer-down outside the picker.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-mist text-sm text-steel hover:text-blue hover:border-blue/30 transition-all"
      >
        <Palette size={14} />
        <span className="flex-1 text-left">Theme</span>
        <span className="flex items-center gap-1">
          <span className="w-3.5 h-3.5 rounded-full border border-mist" style={{ background: current.swatch[0] }} />
          <span className="w-3.5 h-3.5 rounded-full" style={{ background: current.swatch[1] }} />
        </span>
      </button>

      {open && (
        <>
          <div className="absolute bottom-full left-0 right-0 mb-2 z-50 max-h-80 overflow-y-auto rounded-xl border border-mist bg-white shadow-xl p-1.5">
            {ADMIN_THEMES.map(t => {
              const active = t.id === themeId
              return (
                <button
                  key={t.id}
                  onClick={() => { setTheme(t.id); setOpen(false) }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active ? 'bg-blue-wash text-blue' : 'text-slate hover:bg-cloud'
                  }`}
                >
                  <span className="flex items-center gap-1 shrink-0">
                    <span className="w-4 h-4 rounded-full border border-mist" style={{ background: t.swatch[0] }} />
                    <span className="w-4 h-4 rounded-full" style={{ background: t.swatch[1] }} />
                  </span>
                  <span className="flex-1 text-left">{t.name}</span>
                  {active && <Check size={14} />}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
