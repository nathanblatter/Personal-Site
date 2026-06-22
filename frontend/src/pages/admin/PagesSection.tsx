import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Loader2, Save } from 'lucide-react'
import { api, type NowContent, type UsesContent } from '../../lib/api'
import { CONTENT_ICON_OPTIONS } from '../../lib/contentIcons'
import { AdminInput, AdminTextarea, AdminSelect, SectionCard, type AdminCallbacks } from './AdminShared'
import { useUnsavedWarning } from './useUnsavedWarning'

const EMPTY_NOW: NowContent = { last_updated: '', sections: [] }
const EMPTY_USES: UsesContent = { categories: [] }

export default function PagesSection({ showToast, showError }: AdminCallbacks) {
  const [tab, setTab] = useState<'now' | 'uses'>('now')
  const [now, setNow] = useState<NowContent>(EMPTY_NOW)
  const [uses, setUses] = useState<UsesContent>(EMPTY_USES)
  // Last-saved snapshots, for dirty detection.
  const [savedNow, setSavedNow] = useState<NowContent>(EMPTY_NOW)
  const [savedUses, setSavedUses] = useState<UsesContent>(EMPTY_USES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      api.siteContent.get<NowContent>('now').then(r => r.data).catch(() => EMPTY_NOW),
      api.siteContent.get<UsesContent>('uses').then(r => r.data).catch(() => EMPTY_USES),
    ]).then(([n, u]) => {
      const loadedNow = { last_updated: n.last_updated ?? '', sections: n.sections ?? [] }
      const loadedUses = { categories: u.categories ?? [] }
      setNow(loadedNow); setSavedNow(loadedNow)
      setUses(loadedUses); setSavedUses(loadedUses)
    }).finally(() => setLoading(false))
  }, [])

  const dirtyNow = JSON.stringify(now) !== JSON.stringify(savedNow)
  const dirtyUses = JSON.stringify(uses) !== JSON.stringify(savedUses)
  const dirty = dirtyNow || dirtyUses
  const activeDirty = tab === 'now' ? dirtyNow : dirtyUses
  useUnsavedWarning(dirty)

  const save = useCallback(async () => {
    setSaving(true)
    try {
      if (tab === 'now') {
        // Trim/filter list items only at save time, so editing stays unrestricted.
        const cleaned: NowContent = {
          ...now,
          sections: now.sections.map(s => ({
            ...s,
            items: s.items.map(i => i.trim()).filter(Boolean),
          })),
        }
        await api.siteContent.update('now', cleaned)
        setNow(cleaned); setSavedNow(cleaned)
      } else {
        await api.siteContent.update('uses', uses)
        setSavedUses(uses)
      }
      showToast(`Saved /${tab}`)
    } catch (err) {
      showError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }, [tab, now, uses, showToast, showError])

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-steel">
        <Loader2 size={18} className="animate-spin text-blue" />
        <span className="font-mono text-sm">Loading content…</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Pages</h1>
          <p className="text-sm text-steel mt-1">Edit the content shown on /now and /uses.</p>
        </div>
        <div className="flex items-center gap-3">
          {activeDirty && (
            <span className="flex items-center gap-1.5 font-mono text-xs text-ember">
              <span className="w-1.5 h-1.5 rounded-full bg-ember" /> Unsaved
            </span>
          )}
          <button
            onClick={save}
            disabled={saving || !activeDirty}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue text-white text-sm font-medium hover:bg-blue-dim transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Save /{tab}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['now', 'uses'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-wider transition-colors ${
              tab === t ? 'bg-blue-wash text-blue' : 'text-steel hover:text-ink hover:bg-cloud'
            }`}
          >
            /{t}
          </button>
        ))}
      </div>

      {tab === 'now' ? (
        <NowEditor now={now} setNow={setNow} />
      ) : (
        <UsesEditor uses={uses} setUses={setUses} />
      )}
    </div>
  )
}

/* ── /now editor ──────────────────────────────────────────────────────────── */

function NowEditor({ now, setNow }: { now: NowContent; setNow: (n: NowContent) => void }) {
  const updateSection = (i: number, patch: Partial<NowContent['sections'][number]>) =>
    setNow({ ...now, sections: now.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) })

  return (
    <div className="space-y-5">
      <SectionCard>
        <AdminInput
          label="Last updated"
          value={now.last_updated}
          onChange={v => setNow({ ...now, last_updated: v })}
          placeholder="June 2026"
        />
      </SectionCard>

      {now.sections.map((section, i) => (
        <SectionCard key={i}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <span className="font-mono text-[11px] text-steel uppercase tracking-wider pt-2">Section {i + 1}</span>
            <button
              onClick={() => setNow({ ...now, sections: now.sections.filter((_, j) => j !== i) })}
              className="text-silver hover:text-ember transition-colors p-1"
              aria-label="Remove section"
            >
              <Trash2 size={15} />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <AdminSelect label="Icon" value={section.icon} onChange={v => updateSection(i, { icon: v })} options={CONTENT_ICON_OPTIONS} />
            <AdminInput label="Title" value={section.title} onChange={v => updateSection(i, { title: v })} />
          </div>
          <AdminTextarea
            label="Items (one per line)"
            value={section.items.join('\n')}
            onChange={v => updateSection(i, { items: v.split('\n') })}
            rows={4}
          />
        </SectionCard>
      ))}

      <button
        onClick={() => setNow({ ...now, sections: [...now.sections, { icon: 'Sparkles', title: '', items: [] }] })}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-mist text-steel hover:text-blue hover:border-blue/40 transition-colors text-sm"
      >
        <Plus size={15} /> Add section
      </button>
    </div>
  )
}

/* ── /uses editor ─────────────────────────────────────────────────────────── */

function UsesEditor({ uses, setUses }: { uses: UsesContent; setUses: (u: UsesContent) => void }) {
  const updateCat = (i: number, patch: Partial<UsesContent['categories'][number]>) =>
    setUses({ ...uses, categories: uses.categories.map((c, j) => (j === i ? { ...c, ...patch } : c)) })

  return (
    <div className="space-y-5">
      {uses.categories.map((cat, i) => (
        <SectionCard key={i}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <span className="font-mono text-[11px] text-steel uppercase tracking-wider pt-2">Category {i + 1}</span>
            <button
              onClick={() => setUses({ ...uses, categories: uses.categories.filter((_, j) => j !== i) })}
              className="text-silver hover:text-ember transition-colors p-1"
              aria-label="Remove category"
            >
              <Trash2 size={15} />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <AdminSelect label="Icon" value={cat.icon} onChange={v => updateCat(i, { icon: v })} options={CONTENT_ICON_OPTIONS} />
            <AdminInput label="Title" value={cat.title} onChange={v => updateCat(i, { title: v })} />
          </div>

          <div className="space-y-2">
            <label className="block font-mono text-[11px] text-steel mb-1 tracking-wider uppercase">Items</label>
            {cat.items.map((item, j) => (
              <div key={j} className="flex gap-2 items-center">
                <input
                  value={item.name}
                  onChange={e => updateCat(i, { items: cat.items.map((it, k) => (k === j ? { ...it, name: e.target.value } : it)) })}
                  placeholder="Name"
                  className="flex-1 px-3 py-2 bg-white border border-mist rounded-lg text-sm text-ink placeholder-silver focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all"
                />
                <input
                  value={item.note}
                  onChange={e => updateCat(i, { items: cat.items.map((it, k) => (k === j ? { ...it, note: e.target.value } : it)) })}
                  placeholder="Note"
                  className="flex-1 px-3 py-2 bg-white border border-mist rounded-lg text-sm text-ink placeholder-silver focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all"
                />
                <button
                  onClick={() => updateCat(i, { items: cat.items.filter((_, k) => k !== j) })}
                  className="text-silver hover:text-ember transition-colors p-1.5 shrink-0"
                  aria-label="Remove item"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              onClick={() => updateCat(i, { items: [...cat.items, { name: '', note: '' }] })}
              className="inline-flex items-center gap-1.5 mt-1 font-mono text-xs text-steel hover:text-blue transition-colors"
            >
              <Plus size={13} /> Add item
            </button>
          </div>
        </SectionCard>
      ))}

      <button
        onClick={() => setUses({ ...uses, categories: [...uses.categories, { icon: 'Wrench', title: '', items: [] }] })}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-mist text-steel hover:text-blue hover:border-blue/40 transition-colors text-sm"
      >
        <Plus size={15} /> Add category
      </button>
    </div>
  )
}
