import { useState } from 'react'
import { Plus, Trash2, FileText, Clock, Receipt, Link as LinkIcon, Check } from 'lucide-react'
import {
  api, type EngagementDetail, type EngagementResponse, type BillingType, type ContractResponse,
} from '../../../lib/api'
import { AdminInput, AdminSelect, AdminTextarea } from '../AdminShared'
import { fmtCents, dollarsToCents, fmtMinutes, fmtDate, Pill } from './crmShared'
import type { CrmShared } from '../ConsultingSection'

const BILLING_OPTS = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'fixed', label: 'Fixed fee' },
  { value: 'retainer', label: 'Monthly retainer' },
]

export default function EngagementsTab({ shared }: { shared: CrmShared }) {
  const { engagements, contacts, showToast, showError, reloadEngagements, reloadDashboard } = shared
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ contact_id: '', title: '', billing_type: 'hourly' as BillingType, amount: '' })
  const [detail, setDetail] = useState<EngagementDetail | null>(null)

  const refreshDetail = async (id: string) => setDetail(await api.crm.engagements.get(id))

  const create = async () => {
    if (!form.contact_id || !form.title.trim()) { showError('Contact and title required'); return }
    const amountCents = dollarsToCents(form.amount)
    const body: Partial<EngagementResponse> = { contact_id: form.contact_id, title: form.title.trim(), billing_type: form.billing_type }
    if (form.billing_type === 'hourly') body.rate_cents = amountCents
    else if (form.billing_type === 'fixed') body.fixed_amount_cents = amountCents
    else body.retainer_amount_cents = amountCents
    try {
      await api.crm.engagements.create(body)
      setForm({ contact_id: '', title: '', billing_type: 'hourly', amount: '' }); setAdding(false)
      await Promise.all([reloadEngagements(), reloadDashboard()])
      showToast('Engagement created')
    } catch (e) { showError((e as Error).message) }
  }

  if (detail) return <EngagementDetailView detail={detail} shared={shared} onBack={() => { setDetail(null); reloadEngagements(); reloadDashboard() }} refresh={() => refreshDetail(detail.id)} />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setAdding(a => !a)} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue text-white rounded-lg text-sm font-medium hover:bg-blue/90">
          <Plus size={15} /> New engagement
        </button>
      </div>

      {adding && (
        <div className="bg-snow border border-mist rounded-xl p-5 grid md:grid-cols-2 gap-3 items-end">
          <AdminSelect label="Client" value={form.contact_id} onChange={v => setForm({ ...form, contact_id: v })}
            options={[{ value: '', label: 'Select…' }, ...contacts.map(c => ({ value: c.id, label: c.name }))]} />
          <AdminInput label="Title" value={form.title} onChange={v => setForm({ ...form, title: v })} placeholder="Q3 Advisory" />
          <AdminSelect label="Billing" value={form.billing_type} onChange={v => setForm({ ...form, billing_type: v as BillingType })} options={BILLING_OPTS} />
          <AdminInput label={form.billing_type === 'hourly' ? 'Rate / hr ($)' : form.billing_type === 'retainer' ? 'Monthly ($)' : 'Fixed fee ($)'} value={form.amount} onChange={v => setForm({ ...form, amount: v })} placeholder="150" />
          <button onClick={create} className="md:col-span-2 px-4 py-2.5 bg-blue text-white rounded-lg text-sm font-medium hover:bg-blue/90">Create</button>
        </div>
      )}

      <div className="bg-snow border border-mist rounded-xl divide-y divide-mist overflow-hidden">
        {engagements.map(e => (
          <button key={e.id} onClick={() => refreshDetail(e.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-cloud transition-colors">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-ink truncate">{e.title}</div>
              <div className="text-xs text-steel truncate">{e.contact_name}</div>
            </div>
            <span className="font-mono text-[10px] text-steel">{e.billing_type}</span>
            <Pill label={e.status} kind="engagement" />
          </button>
        ))}
        {engagements.length === 0 && <div className="text-center text-sm text-silver py-8">No engagements yet</div>}
      </div>
    </div>
  )
}

function EngagementDetailView({ detail, shared, onBack, refresh }: { detail: EngagementDetail; shared: CrmShared; onBack: () => void; refresh: () => Promise<void> }) {
  const { showToast, showError } = shared
  const [te, setTe] = useState({ entry_date: new Date().toISOString().slice(0, 10), hours: '', description: '' })
  const [contractTitle, setContractTitle] = useState('')
  const [contractScope, setContractScope] = useState('')
  const [copied, setCopied] = useState('')

  const unbilledMin = detail.time_entries.filter(t => t.billable && !t.invoice_id).reduce((s, t) => s + t.minutes, 0)

  const addTime = async () => {
    const minutes = Math.round(parseFloat(te.hours || '0') * 60)
    if (!minutes) { showError('Enter hours'); return }
    try {
      await api.crm.timeEntries.create({ engagement_id: detail.id, entry_date: te.entry_date, minutes, description: te.description })
      setTe({ ...te, hours: '', description: '' })
      await refresh()
      showToast('Time logged')
    } catch (e) { showError((e as Error).message) }
  }

  const delTime = async (id: string) => {
    try { await api.crm.timeEntries.delete(id); await refresh() } catch (e) { showError((e as Error).message) }
  }

  const addContract = async () => {
    if (!contractTitle.trim()) { showError('Contract title required'); return }
    try {
      await api.crm.contracts.create({ engagement_id: detail.id, title: contractTitle.trim(), scope_md: contractScope })
      setContractTitle(''); setContractScope('')
      await refresh()
      showToast('Contract drafted')
    } catch (e) { showError((e as Error).message) }
  }

  const sendContract = async (c: ContractResponse) => {
    try {
      const sent = await api.crm.contracts.send(c.id)
      await refresh()
      if (sent.public_token) copyLink(`${window.location.origin}/contract/${sent.public_token}`, c.id)
      showToast('Contract sent — link copied')
    } catch (e) { showError((e as Error).message) }
  }

  const delContract = async (id: string) => {
    try { await api.crm.contracts.delete(id); await refresh() } catch (e) { showError((e as Error).message) }
  }

  const generate = async (mode: BillingType) => {
    try {
      await api.crm.invoices.generate({ engagement_id: detail.id, mode })
      await refresh()
      showToast('Invoice generated')
    } catch (e) { showError((e as Error).message) }
  }

  const copyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url)
    setCopied(id); setTimeout(() => setCopied(''), 1500)
  }

  const rateLabel = detail.billing_type === 'hourly' ? `${fmtCents(detail.rate_cents)}/hr`
    : detail.billing_type === 'retainer' ? `${fmtCents(detail.retainer_amount_cents)}/mo`
    : fmtCents(detail.fixed_amount_cents)

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-sm text-blue hover:underline">← All engagements</button>

      <div className="bg-snow border border-mist rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-ink">{detail.title}</h3>
            <div className="text-sm text-steel">{detail.contact_name} · {detail.billing_type} · {rateLabel}</div>
          </div>
          <Pill label={detail.status} kind="engagement" />
        </div>
      </div>

      {/* Time tracking */}
      <div className="bg-snow border border-mist rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3 text-steel">
          <Clock size={15} /><span className="font-mono text-[10px] uppercase tracking-wider">Time</span>
          <span className="text-xs">· {fmtMinutes(unbilledMin)} unbilled</span>
        </div>
        <div className="grid grid-cols-[120px_90px_1fr_auto] gap-2 items-end mb-3">
          <AdminInput label="Date" value={te.entry_date} onChange={v => setTe({ ...te, entry_date: v })} type="date" />
          <AdminInput label="Hours" value={te.hours} onChange={v => setTe({ ...te, hours: v })} placeholder="1.5" />
          <AdminInput label="Description" value={te.description} onChange={v => setTe({ ...te, description: v })} />
          <button onClick={addTime} className="px-3 py-2.5 bg-blue text-white rounded-lg text-sm hover:bg-blue/90">Log</button>
        </div>
        <div className="space-y-1">
          {detail.time_entries.map(t => (
            <div key={t.id} className="flex items-center gap-3 text-xs py-1 group">
              <span className="text-steel font-mono">{fmtDate(t.entry_date)}</span>
              <span className="text-ink">{fmtMinutes(t.minutes)}</span>
              <span className="text-steel truncate flex-1">{t.description}</span>
              {t.invoice_id ? <span className="font-mono text-[9px] text-teal uppercase">billed</span>
                : <button onClick={() => delTime(t.id)} className="text-silver hover:text-ember opacity-0 group-hover:opacity-100"><Trash2 size={12} /></button>}
            </div>
          ))}
          {detail.time_entries.length === 0 && <div className="text-xs text-silver">No time logged</div>}
        </div>
      </div>

      {/* Contracts */}
      <div className="bg-snow border border-mist rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3 text-steel">
          <FileText size={15} /><span className="font-mono text-[10px] uppercase tracking-wider">Contracts</span>
        </div>
        <div className="space-y-2 mb-4">
          {detail.contracts.map(c => (
            <div key={c.id} className="flex items-center gap-2 text-sm border border-mist rounded-lg px-3 py-2">
              <span className="text-ink flex-1 truncate">{c.title}</span>
              <Pill label={c.status} kind="contract" />
              {c.public_token && (
                <button onClick={() => copyLink(`${window.location.origin}/contract/${c.public_token}`, c.id)} className="text-steel hover:text-blue" title="Copy link">
                  {copied === c.id ? <Check size={13} className="text-teal" /> : <LinkIcon size={13} />}
                </button>
              )}
              {c.status === 'draft' && <button onClick={() => sendContract(c)} className="text-xs text-blue hover:underline">Send</button>}
              <a href={api.crm.contracts.pdfUrl(c.id)} target="_blank" rel="noopener noreferrer" className="text-steel hover:text-blue" title="PDF"><FileText size={13} /></a>
              <button onClick={() => delContract(c.id)} className="text-silver hover:text-ember"><Trash2 size={13} /></button>
            </div>
          ))}
          {detail.contracts.length === 0 && <div className="text-xs text-silver">No contracts</div>}
        </div>
        <div className="space-y-2 border-t border-mist pt-3">
          <AdminInput label="New contract title" value={contractTitle} onChange={setContractTitle} placeholder="Statement of Work" />
          <AdminTextarea label="Scope" value={contractScope} onChange={setContractScope} rows={3} />
          <button onClick={addContract} className="px-3 py-2 bg-cloud text-steel rounded-lg hover:bg-blue-wash hover:text-blue text-sm">Draft contract</button>
        </div>
      </div>

      {/* Invoices */}
      <div className="bg-snow border border-mist rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3 text-steel">
          <Receipt size={15} /><span className="font-mono text-[10px] uppercase tracking-wider">Invoices</span>
          <div className="ml-auto flex gap-2">
            {detail.billing_type === 'hourly' && <button onClick={() => generate('hourly')} className="text-xs px-2.5 py-1.5 bg-cloud text-steel rounded-lg hover:bg-blue-wash hover:text-blue">Bill hours</button>}
            {detail.billing_type === 'fixed' && <button onClick={() => generate('fixed')} className="text-xs px-2.5 py-1.5 bg-cloud text-steel rounded-lg hover:bg-blue-wash hover:text-blue">Bill fixed fee</button>}
            {detail.billing_type === 'retainer' && <button onClick={() => generate('retainer')} className="text-xs px-2.5 py-1.5 bg-cloud text-steel rounded-lg hover:bg-blue-wash hover:text-blue">Bill retainer</button>}
          </div>
        </div>
        <div className="space-y-1.5">
          {detail.invoices.map(inv => (
            <div key={inv.id} className="flex items-center gap-3 text-sm border border-mist rounded-lg px-3 py-2">
              <span className="font-mono text-xs text-ink">{inv.number}</span>
              <Pill label={inv.status} />
              <span className="ml-auto font-medium text-ink">{fmtCents(inv.total_cents)}</span>
              <a href={api.crm.invoices.pdfUrl(inv.id)} target="_blank" rel="noopener noreferrer" className="text-steel hover:text-blue" title="PDF"><FileText size={13} /></a>
            </div>
          ))}
          {detail.invoices.length === 0 && <div className="text-xs text-silver">No invoices — generate one above, then manage it in the Invoices tab</div>}
        </div>
      </div>
    </div>
  )
}
