import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Plus, Trash2, GripVertical, Save, X, Pencil, Star, Loader2 } from 'lucide-react'
import {
  api,
  type ServicesMetaResponse,
  type ServiceOfferingResponse,
  type ServiceProcessStepResponse,
  type EngagementTierResponse,
} from '../../lib/api'
import { AdminInput, AdminTextarea, SectionCard, type AdminCallbacks } from './AdminShared'
import { useUnsavedWarning } from './useUnsavedWarning'
import { useDragReorder } from './useDragReorder'

export default function ServicesSection({ showToast, showError }: AdminCallbacks) {
  const [loading, setLoading] = useState(true)
  const [meta, setMeta] = useState<ServicesMetaResponse | null>(null)
  const [offerings, setOfferings] = useState<ServiceOfferingResponse[]>([])
  const [process, setProcess] = useState<ServiceProcessStepResponse[]>([])
  const [tiers, setTiers] = useState<EngagementTierResponse[]>([])

  const [editingOffering, setEditingOffering] = useState<number | null>(null)
  const [editingStep, setEditingStep] = useState<number | null>(null)
  const [editingTier, setEditingTier] = useState<number | null>(null)
  const [metaDirty, setMetaDirty] = useState(false)
  useUnsavedWarning(editingOffering !== null || editingStep !== null || editingTier !== null || metaDirty)

  useEffect(() => {
    Promise.all([
      api.services.meta.get().catch(() => null),
      api.services.offerings.list(),
      api.services.process.list(),
      api.services.tiers.list(),
    ]).then(([m, o, p, t]) => {
      setMeta(m ?? { id: 1, heading: '', subheading: '', intro: '', cta_heading: '', cta_text: '', cta_button_label: 'Book a Call' })
      setOfferings(o); setProcess(p); setTiers(t)
    }).catch(err => showError((err as Error).message)).finally(() => setLoading(false))
  }, [showError])

  // ── Reorder helpers ──────────────────────────────────────────────────────
  const offeringDrag = useDragReorder(offerings, async (next) => {
    const reindexed = next.map((x, i) => ({ ...x, sort_order: i }))
    const changed = reindexed.filter(x => offerings.find(o => o.id === x.id)?.sort_order !== x.sort_order)
    setOfferings(reindexed)
    try { await Promise.all(changed.map(x => api.services.offerings.update(x.id, { sort_order: x.sort_order }))) }
    catch (err) { showError((err as Error).message) }
  })
  const stepDrag = useDragReorder(process, async (next) => {
    const reindexed = next.map((x, i) => ({ ...x, sort_order: i }))
    const changed = reindexed.filter(x => process.find(o => o.id === x.id)?.sort_order !== x.sort_order)
    setProcess(reindexed)
    try { await Promise.all(changed.map(x => api.services.process.update(x.id, { sort_order: x.sort_order }))) }
    catch (err) { showError((err as Error).message) }
  })
  const tierDrag = useDragReorder(tiers, async (next) => {
    const reindexed = next.map((x, i) => ({ ...x, sort_order: i }))
    const changed = reindexed.filter(x => tiers.find(o => o.id === x.id)?.sort_order !== x.sort_order)
    setTiers(reindexed)
    try { await Promise.all(changed.map(x => api.services.tiers.update(x.id, { sort_order: x.sort_order }))) }
    catch (err) { showError((err as Error).message) }
  })

  // ── Meta ─────────────────────────────────────────────────────────────────
  const setMetaField = (field: keyof ServicesMetaResponse, value: string) => {
    setMeta(m => m ? { ...m, [field]: value } : m)
    setMetaDirty(true)
  }
  const saveMeta = async () => {
    if (!meta) return
    try {
      const { id: _id, ...data } = meta
      const updated = await api.services.meta.update(data)
      setMeta(updated); setMetaDirty(false)
      showToast('Page copy saved')
    } catch (err) { showError((err as Error).message) }
  }

  // ── Offerings ──────────────────────────────────────────────────────────────
  const setOfferingLocal = (id: number, field: string, value: unknown) =>
    setOfferings(prev => prev.map(o => o.id === id ? { ...o, [field]: value } : o))
  const addOffering = async () => {
    try {
      const created = await api.services.offerings.create({ icon: 'Code2', title: 'New Offering', description: '', sort_order: offerings.length })
      setOfferings(prev => [...prev, created]); setEditingOffering(created.id)
    } catch (err) { showError((err as Error).message) }
  }
  const saveOffering = async (o: ServiceOfferingResponse) => {
    try {
      const updated = await api.services.offerings.update(o.id, o)
      setOfferings(prev => prev.map(x => x.id === updated.id ? updated : x))
      setEditingOffering(null); showToast('Offering saved')
    } catch (err) { showError((err as Error).message) }
  }
  const deleteOffering = async (id: number) => {
    try { await api.services.offerings.delete(id); setOfferings(prev => prev.filter(o => o.id !== id)); showToast('Offering removed') }
    catch (err) { showError((err as Error).message) }
  }

  // ── Process steps ───────────────────────────────────────────────────────────
  const setStepLocal = (id: number, field: string, value: unknown) =>
    setProcess(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  const addStep = async () => {
    try {
      const created = await api.services.process.create({ title: 'New Step', description: '', sort_order: process.length })
      setProcess(prev => [...prev, created]); setEditingStep(created.id)
    } catch (err) { showError((err as Error).message) }
  }
  const saveStep = async (s: ServiceProcessStepResponse) => {
    try {
      const updated = await api.services.process.update(s.id, s)
      setProcess(prev => prev.map(x => x.id === updated.id ? updated : x))
      setEditingStep(null); showToast('Step saved')
    } catch (err) { showError((err as Error).message) }
  }
  const deleteStep = async (id: number) => {
    try { await api.services.process.delete(id); setProcess(prev => prev.filter(s => s.id !== id)); showToast('Step removed') }
    catch (err) { showError((err as Error).message) }
  }

  // ── Tiers ────────────────────────────────────────────────────────────────────
  const setTierLocal = (id: number, field: string, value: unknown) =>
    setTiers(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t))
  const addTier = async () => {
    try {
      const created = await api.services.tiers.create({ name: 'New Tier', price_label: 'Let\'s talk', description: '', features: [], cta_label: 'Get Started', highlighted: false, sort_order: tiers.length })
      setTiers(prev => [...prev, created]); setEditingTier(created.id)
    } catch (err) { showError((err as Error).message) }
  }
  const saveTier = async (t: EngagementTierResponse) => {
    try {
      const updated = await api.services.tiers.update(t.id, t)
      setTiers(prev => prev.map(x => x.id === updated.id ? updated : x))
      setEditingTier(null); showToast('Tier saved')
    } catch (err) { showError((err as Error).message) }
  }
  const deleteTier = async (id: number) => {
    try { await api.services.tiers.delete(id); setTiers(prev => prev.filter(t => t.id !== id)); showToast('Tier removed') }
    catch (err) { showError((err as Error).message) }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-steel py-20 justify-center">
        <Loader2 size={20} className="animate-spin text-blue" />
        <span className="font-mono text-sm">Loading services…</span>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
      <div>
        <h2 className="text-2xl font-sans font-semibold text-ink mb-1">Services</h2>
        <p className="text-steel text-sm">The public “Work With Me” page — copy, offerings, process, and pricing.</p>
      </div>

      {/* ── Page copy ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-xs tracking-wider uppercase text-steel">Page Copy</h3>
          <button onClick={saveMeta} disabled={!metaDirty} className="inline-flex items-center gap-2 px-4 py-2 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors disabled:opacity-40">
            <Save size={13} /> Save Copy
          </button>
        </div>
        {meta && (
          <SectionCard className="space-y-4">
            <AdminInput label="Heading" value={meta.heading} onChange={v => setMetaField('heading', v)} />
            <AdminInput label="Subheading" value={meta.subheading} onChange={v => setMetaField('subheading', v)} />
            <AdminTextarea label="Intro" value={meta.intro} onChange={v => setMetaField('intro', v)} rows={3} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AdminInput label="CTA Heading" value={meta.cta_heading} onChange={v => setMetaField('cta_heading', v)} />
              <AdminInput label="CTA Button Label" value={meta.cta_button_label} onChange={v => setMetaField('cta_button_label', v)} />
            </div>
            <AdminTextarea label="CTA Text" value={meta.cta_text} onChange={v => setMetaField('cta_text', v)} rows={2} />
          </SectionCard>
        )}
      </div>

      {/* ── Offerings ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-xs tracking-wider uppercase text-steel">Offerings ({offerings.length})</h3>
          <button onClick={addOffering} className="inline-flex items-center gap-2 px-4 py-2 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors">
            <Plus size={13} /> Add Offering
          </button>
        </div>
        <div className="space-y-3">
          {offerings.map(o => (
            <SectionCard key={o.id} {...offeringDrag.dropTargetProps(o.id)} className={`!p-0 overflow-hidden ${offeringDrag.overId === o.id ? 'ring-2 ring-blue/30' : ''}`}>
              <div className="flex items-center gap-2 px-4 py-3">
                <span {...offeringDrag.dragHandleProps(o.id)} className="cursor-grab text-silver hover:text-steel" title="Drag to reorder"><GripVertical size={14} /></span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-ink block truncate">{o.title}</span>
                  <span className="font-mono text-[11px] text-steel">{o.icon}</span>
                </div>
                {editingOffering === o.id ? (
                  <>
                    <button onClick={() => saveOffering(o)} className="p-1.5 text-teal hover:bg-teal/10 rounded-lg"><Save size={14} /></button>
                    <button onClick={() => setEditingOffering(null)} className="p-1.5 text-steel hover:bg-cloud rounded-lg"><X size={14} /></button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setEditingOffering(o.id)} className="p-1.5 text-steel hover:text-blue hover:bg-blue-wash rounded-lg"><Pencil size={14} /></button>
                    <button onClick={() => deleteOffering(o.id)} className="p-1.5 text-steel hover:text-ember hover:bg-ember/5 rounded-lg"><Trash2 size={14} /></button>
                  </>
                )}
              </div>
              {editingOffering === o.id && (
                <div className="px-4 pb-4 space-y-3 border-t border-mist pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <AdminInput label="Icon (lucide name)" value={o.icon} onChange={v => setOfferingLocal(o.id, 'icon', v)} mono />
                    <AdminInput label="Title" value={o.title} onChange={v => setOfferingLocal(o.id, 'title', v)} />
                  </div>
                  <AdminTextarea label="Description" value={o.description} onChange={v => setOfferingLocal(o.id, 'description', v)} rows={2} />
                </div>
              )}
            </SectionCard>
          ))}
        </div>
      </div>

      {/* ── Process ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-xs tracking-wider uppercase text-steel">Process Steps ({process.length})</h3>
          <button onClick={addStep} className="inline-flex items-center gap-2 px-4 py-2 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors">
            <Plus size={13} /> Add Step
          </button>
        </div>
        <div className="space-y-3">
          {process.map((s, i) => (
            <SectionCard key={s.id} {...stepDrag.dropTargetProps(s.id)} className={`!p-0 overflow-hidden ${stepDrag.overId === s.id ? 'ring-2 ring-blue/30' : ''}`}>
              <div className="flex items-center gap-2 px-4 py-3">
                <span {...stepDrag.dragHandleProps(s.id)} className="cursor-grab text-silver hover:text-steel" title="Drag to reorder"><GripVertical size={14} /></span>
                <span className="font-mono text-xs text-blue w-5">{i + 1}</span>
                <span className="flex-1 min-w-0 text-sm font-medium text-ink truncate">{s.title}</span>
                {editingStep === s.id ? (
                  <>
                    <button onClick={() => saveStep(s)} className="p-1.5 text-teal hover:bg-teal/10 rounded-lg"><Save size={14} /></button>
                    <button onClick={() => setEditingStep(null)} className="p-1.5 text-steel hover:bg-cloud rounded-lg"><X size={14} /></button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setEditingStep(s.id)} className="p-1.5 text-steel hover:text-blue hover:bg-blue-wash rounded-lg"><Pencil size={14} /></button>
                    <button onClick={() => deleteStep(s.id)} className="p-1.5 text-steel hover:text-ember hover:bg-ember/5 rounded-lg"><Trash2 size={14} /></button>
                  </>
                )}
              </div>
              {editingStep === s.id && (
                <div className="px-4 pb-4 space-y-3 border-t border-mist pt-4">
                  <AdminInput label="Title" value={s.title} onChange={v => setStepLocal(s.id, 'title', v)} />
                  <AdminTextarea label="Description" value={s.description} onChange={v => setStepLocal(s.id, 'description', v)} rows={2} />
                </div>
              )}
            </SectionCard>
          ))}
        </div>
      </div>

      {/* ── Tiers ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-xs tracking-wider uppercase text-steel">Engagement Tiers ({tiers.length})</h3>
          <button onClick={addTier} className="inline-flex items-center gap-2 px-4 py-2 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors">
            <Plus size={13} /> Add Tier
          </button>
        </div>
        <div className="space-y-3">
          {tiers.map(t => (
            <SectionCard key={t.id} {...tierDrag.dropTargetProps(t.id)} className={`!p-0 overflow-hidden ${tierDrag.overId === t.id ? 'ring-2 ring-blue/30' : ''}`}>
              <div className="flex items-center gap-2 px-4 py-3">
                <span {...tierDrag.dragHandleProps(t.id)} className="cursor-grab text-silver hover:text-steel" title="Drag to reorder"><GripVertical size={14} /></span>
                {t.highlighted && <Star size={13} className="text-blue fill-blue" />}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-ink block truncate">{t.name}</span>
                  <span className="font-mono text-[11px] text-steel">{t.price_label}</span>
                </div>
                {editingTier === t.id ? (
                  <>
                    <button onClick={() => saveTier(t)} className="p-1.5 text-teal hover:bg-teal/10 rounded-lg"><Save size={14} /></button>
                    <button onClick={() => setEditingTier(null)} className="p-1.5 text-steel hover:bg-cloud rounded-lg"><X size={14} /></button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setEditingTier(t.id)} className="p-1.5 text-steel hover:text-blue hover:bg-blue-wash rounded-lg"><Pencil size={14} /></button>
                    <button onClick={() => deleteTier(t.id)} className="p-1.5 text-steel hover:text-ember hover:bg-ember/5 rounded-lg"><Trash2 size={14} /></button>
                  </>
                )}
              </div>
              {editingTier === t.id && (
                <div className="px-4 pb-4 space-y-3 border-t border-mist pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <AdminInput label="Name" value={t.name} onChange={v => setTierLocal(t.id, 'name', v)} />
                    <AdminInput label="Price Label" value={t.price_label} onChange={v => setTierLocal(t.id, 'price_label', v)} />
                  </div>
                  <AdminTextarea label="Description" value={t.description} onChange={v => setTierLocal(t.id, 'description', v)} rows={2} />
                  <AdminTextarea
                    label="Features (one per line)"
                    value={t.features.join('\n')}
                    onChange={v => setTierLocal(t.id, 'features', v.split('\n').map(x => x.trim()).filter(Boolean))}
                    rows={4}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <AdminInput label="CTA Label" value={t.cta_label} onChange={v => setTierLocal(t.id, 'cta_label', v)} />
                    <label className="flex items-center gap-2 font-mono text-xs text-steel whitespace-nowrap pt-5">
                      <input type="checkbox" checked={t.highlighted} onChange={e => setTierLocal(t.id, 'highlighted', e.target.checked)} />
                      Highlighted
                    </label>
                  </div>
                </div>
              )}
            </SectionCard>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
