import { useState } from 'react'
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

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
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
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
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
