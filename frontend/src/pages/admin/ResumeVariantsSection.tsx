import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { Plus, Trash2, Save, Star, ScrollText, Download } from 'lucide-react'
import { api, type ResumeVariantResponse } from '../../lib/api'
import { AdminInput, AdminTextarea, SectionCard, type AdminCallbacks } from './AdminShared'

export default function ResumeVariantsSection({ showToast, showError }: AdminCallbacks) {
  const [variants, setVariants] = useState<ResumeVariantResponse[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    api.resume.variants.list()
      .then(r => { setVariants(r); setLoaded(true) })
      .catch(e => showError((e as Error).message))
  }, [showError])

  const patch = (id: number, field: keyof ResumeVariantResponse, value: unknown) =>
    setVariants(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v))

  const add = async () => {
    try {
      const created = await api.resume.variants.create({
        key: `variant-${variants.length + 1}`,
        label: 'New Variant',
        headline: 'Headline shown in bold at the start of the summary',
        summary: 'The rest of the tailored summary paragraph.',
        emphasis_tags: [],
        sort_order: variants.length,
        is_default: variants.length === 0,
      })
      setVariants(prev => [...prev, created])
      showToast('Variant added')
    } catch (e) { showError((e as Error).message) }
  }

  const save = async (v: ResumeVariantResponse) => {
    try {
      const updated = await api.resume.variants.update(v.id, {
        key: v.key, label: v.label, headline: v.headline, summary: v.summary,
        emphasis_tags: v.emphasis_tags, sort_order: v.sort_order, is_default: v.is_default,
      })
      // A save may have flipped is_default off on the others — refetch to stay in sync.
      const fresh = await api.resume.variants.list()
      setVariants(fresh)
      showToast(`Saved · /resume.pdf?variant=${updated.key}`)
    } catch (e) { showError((e as Error).message) }
  }

  const remove = async (id: number) => {
    try {
      await api.resume.variants.delete(id)
      setVariants(prev => prev.filter(v => v.id !== id))
      showToast('Variant removed')
    } catch (e) { showError((e as Error).message) }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-sans font-semibold text-ink mb-1">Résumé Variants</h2>
          <p className="text-steel text-sm">Tailored flavors (SWE / Data / AI). Each overrides the résumé summary and surfaces projects matching its emphasis tags. Starred = default shown first.</p>
        </div>
        <button onClick={add} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-blue bg-blue-wash rounded-lg hover:bg-blue/10 transition-colors shrink-0">
          <Plus size={12} /> Add
        </button>
      </div>

      <div className="space-y-4">
        {variants.map(v => (
          <SectionCard key={v.id}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-sans font-semibold text-ink flex items-center gap-2">
                <ScrollText size={15} className="text-blue" /> {v.label || v.key}
              </h3>
              <div className="flex items-center gap-1">
                <a
                  href={`/resume.pdf?variant=${v.key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-steel hover:text-blue transition-colors"
                  title="Preview PDF"
                >
                  <Download size={14} />
                </a>
                <button
                  onClick={() => patch(v.id, 'is_default', !v.is_default)}
                  className={`p-1.5 transition-colors ${v.is_default ? 'text-violet' : 'text-silver hover:text-violet'}`}
                  title={v.is_default ? 'Default variant' : 'Make default'}
                >
                  <Star size={14} fill={v.is_default ? 'currentColor' : 'none'} />
                </button>
                <button onClick={() => save(v)} className="p-1.5 text-steel hover:text-blue transition-colors" title="Save">
                  <Save size={14} />
                </button>
                <button onClick={() => remove(v.id)} className="p-1.5 text-silver hover:text-ember transition-colors" title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <AdminInput label="Label (tab text)" value={v.label} onChange={val => patch(v.id, 'label', val)} placeholder="Software Engineering" />
              <AdminInput label="Key (URL slug)" value={v.key} onChange={val => patch(v.id, 'key', val)} mono placeholder="swe" />
            </div>
            <div className="mb-4">
              <AdminInput label="Headline (bold lead-in)" value={v.headline} onChange={val => patch(v.id, 'headline', val)} placeholder="Full-Stack Software Engineer" />
            </div>
            <div className="mb-4">
              <AdminTextarea label="Summary" value={v.summary} onChange={val => patch(v.id, 'summary', val)} rows={3} />
            </div>
            <AdminInput
              label="Emphasis tags (comma-separated — projects with these surface first)"
              value={v.emphasis_tags.join(', ')}
              onChange={val => patch(v.id, 'emphasis_tags', val.split(',').map(t => t.trim()).filter(Boolean))}
              mono
              placeholder="react, typescript, python, full-stack"
            />
          </SectionCard>
        ))}
        {loaded && variants.length === 0 && (
          <p className="text-center text-steel text-sm py-8 font-mono">No résumé variants yet. Add one above.</p>
        )}
        {!loaded && (
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-40 rounded-xl bg-cloud animate-pulse" />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
