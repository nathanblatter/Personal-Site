import { useState } from 'react'
import { Plus, Trash2, ChevronRight } from 'lucide-react'
import { api, DEAL_STAGES, type DealStage } from '../../../lib/api'
import { AdminInput, AdminSelect } from '../AdminShared'
import type { CrmShared } from '../ConsultingSection'
import { fmtCents, dollarsToCents, Pill } from './crmShared'

const STAGE_LABELS: Record<DealStage, string> = {
  lead: 'Lead', qualified: 'Qualified', proposal: 'Proposal',
  negotiation: 'Negotiation', won: 'Won', lost: 'Lost',
}

export default function PipelineTab({ shared }: { shared: CrmShared }) {
  const { deals, contacts, showToast, showError, reloadDeals, reloadEngagements, reloadDashboard } = shared
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [contactId, setContactId] = useState('')
  const [value, setValue] = useState('')

  const createDeal = async () => {
    if (!title.trim() || !contactId) { showError('Title and contact required'); return }
    try {
      await api.crm.deals.create({ title: title.trim(), contact_id: contactId, value_cents: dollarsToCents(value) })
      setTitle(''); setValue(''); setContactId(''); setAdding(false)
      await Promise.all([reloadDeals(), reloadDashboard()])
      showToast('Deal created')
    } catch (e) { showError((e as Error).message) }
  }

  const setStage = async (id: string, stage: DealStage) => {
    try {
      const res = await api.crm.deals.setStage(id, { stage })
      await Promise.all([reloadDeals(), reloadDashboard()])
      if (res.engagement) { await reloadEngagements(); showToast('Deal won → engagement created') }
      else showToast(`Moved to ${STAGE_LABELS[stage]}`)
    } catch (e) { showError((e as Error).message) }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this deal?')) return
    try {
      await api.crm.deals.delete(id)
      await Promise.all([reloadDeals(), reloadDashboard()])
      showToast('Deal deleted')
    } catch (e) { showError((e as Error).message) }
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={() => setAdding(a => !a)} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue text-white rounded-lg text-sm font-medium hover:bg-blue/90 transition-colors">
          <Plus size={15} /> New deal
        </button>
      </div>

      {adding && (
        <div className="bg-snow border border-mist rounded-xl p-5 grid md:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <AdminInput label="Title" value={title} onChange={setTitle} placeholder="Website redesign" />
          <AdminSelect label="Contact" value={contactId} onChange={setContactId}
            options={[{ value: '', label: 'Select…' }, ...contacts.map(c => ({ value: c.id, label: c.name }))]} />
          <AdminInput label="Value ($)" value={value} onChange={setValue} placeholder="5000" />
          <button onClick={createDeal} className="px-4 py-2.5 bg-blue text-white rounded-lg text-sm font-medium hover:bg-blue/90">Create</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {DEAL_STAGES.map(stage => {
          const inStage = deals.filter(d => d.stage === stage)
          const total = inStage.reduce((s, d) => s + (d.value_cents ?? 0), 0)
          return (
            <div key={stage} className="bg-cloud/60 border border-mist rounded-xl p-3">
              <div className="flex items-center justify-between mb-3 px-1">
                <Pill label={stage} kind="stage" />
                <span className="font-mono text-[10px] text-steel">{inStage.length} · {fmtCents(total)}</span>
              </div>
              <div className="space-y-2">
                {inStage.map(d => {
                  const idx = DEAL_STAGES.indexOf(d.stage)
                  const next = idx < 4 ? DEAL_STAGES[idx + 1] : null  // up to 'won'
                  return (
                    <div key={d.id} className="bg-white border border-mist rounded-lg p-3 group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-ink truncate">{d.title}</div>
                          <div className="text-xs text-steel truncate">{d.contact_name}</div>
                        </div>
                        <button onClick={() => remove(d.id)} className="text-silver hover:text-ember opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <Trash2 size={13} />
                        </button>
                      </div>
                      {d.value_cents != null && <div className="text-xs font-medium text-ink mt-1">{fmtCents(d.value_cents)}</div>}
                      <div className="flex items-center gap-1.5 mt-2">
                        {next && (
                          <button onClick={() => setStage(d.id, next)} className="inline-flex items-center gap-1 text-[11px] text-blue hover:underline">
                            {STAGE_LABELS[next]} <ChevronRight size={11} />
                          </button>
                        )}
                        {d.stage !== 'lost' && d.stage !== 'won' && (
                          <button onClick={() => setStage(d.id, 'lost')} className="text-[11px] text-steel hover:text-ember ml-auto">Lost</button>
                        )}
                      </div>
                    </div>
                  )
                })}
                {inStage.length === 0 && <div className="text-center text-xs text-silver py-3">—</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
