import { useState, useEffect, useCallback } from 'react'
import { FileText, Link as LinkIcon, Check, Trash2, DollarSign, Loader2 } from 'lucide-react'
import { api, type InvoiceResponse, type PaymentMethod } from '../../../lib/api'
import { AdminInput, AdminSelect } from '../AdminShared'
import type { CrmShared } from '../ConsultingSection'
import { fmtCents, dollarsToCents, centsToDollars, fmtDate, Pill } from './crmShared'

const METHODS = [
  { value: 'venmo', label: 'Venmo' }, { value: 'zelle', label: 'Zelle' },
  { value: 'cash', label: 'Cash' }, { value: 'check', label: 'Check' }, { value: 'other', label: 'Other' },
]

export default function InvoicesTab({ shared }: { shared: CrmShared }) {
  const { showToast, showError, reloadDashboard } = shared
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState('')
  const [payFor, setPayFor] = useState<string | null>(null)
  const [pay, setPay] = useState({ amount: '', method: 'venmo' as PaymentMethod, reference: '' })

  const reload = useCallback(async () => { setInvoices(await api.crm.invoices.list()) }, [])
  useEffect(() => { reload().catch(e => showError((e as Error).message)).finally(() => setLoading(false)) }, [reload, showError])

  const send = async (inv: InvoiceResponse) => {
    try {
      const sent = await api.crm.invoices.send(inv.id)
      await reload()
      if (sent.public_token) { navigator.clipboard.writeText(`${window.location.origin}/invoice/${sent.public_token}`); setCopied(inv.id); setTimeout(() => setCopied(''), 1500) }
      showToast('Invoice sent — link copied')
    } catch (e) { showError((e as Error).message) }
  }

  const copyLink = (inv: InvoiceResponse) => {
    if (!inv.public_token) return
    navigator.clipboard.writeText(`${window.location.origin}/invoice/${inv.public_token}`)
    setCopied(inv.id); setTimeout(() => setCopied(''), 1500)
  }

  const openPay = (inv: InvoiceResponse) => {
    setPayFor(inv.id)
    setPay({ amount: centsToDollars(inv.total_cents - inv.amount_paid_cents), method: 'venmo', reference: '' })
  }

  const recordPayment = async (inv: InvoiceResponse) => {
    try {
      await api.crm.invoices.recordPayment(inv.id, { amount_cents: dollarsToCents(pay.amount), method: pay.method, reference: pay.reference })
      setPayFor(null)
      await Promise.all([reload(), reloadDashboard()])
      showToast('Payment recorded')
    } catch (e) { showError((e as Error).message) }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this invoice?')) return
    try { await api.crm.invoices.delete(id); await Promise.all([reload(), reloadDashboard()]); showToast('Invoice deleted') }
    catch (e) { showError((e as Error).message) }
  }

  if (loading) return <div className="flex items-center gap-2 text-steel py-12 justify-center"><Loader2 size={18} className="animate-spin text-blue" /></div>

  return (
    <div className="space-y-3">
      {invoices.map(inv => {
        const balance = inv.total_cents - inv.amount_paid_cents
        return (
          <div key={inv.id} className="bg-snow border border-mist rounded-xl p-4">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-ink">{inv.number}</span>
              <Pill label={inv.status} />
              {inv.is_retainer && <span className="font-mono text-[9px] text-violet uppercase">retainer</span>}
              <span className="text-sm text-steel">{inv.contact_name || '—'}</span>
              <span className="text-xs text-steel">· issued {fmtDate(inv.issue_date)}{inv.due_date ? ` · due ${fmtDate(inv.due_date)}` : ''}</span>
              <div className="ml-auto text-right">
                <div className="text-sm font-semibold text-ink">{fmtCents(inv.total_cents)}</div>
                {inv.amount_paid_cents > 0 && balance > 0 && <div className="text-[11px] text-steel">{fmtCents(balance)} due</div>}
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-mist">
              {inv.status === 'draft' && <button onClick={() => send(inv)} className="text-xs px-2.5 py-1.5 bg-blue text-white rounded-lg hover:bg-blue/90">Send</button>}
              {inv.public_token && (
                <button onClick={() => copyLink(inv)} className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-cloud text-steel rounded-lg hover:bg-blue-wash hover:text-blue">
                  {copied === inv.id ? <Check size={12} className="text-teal" /> : <LinkIcon size={12} />} Link
                </button>
              )}
              <a href={api.crm.invoices.pdfUrl(inv.id)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-cloud text-steel rounded-lg hover:bg-blue-wash hover:text-blue">
                <FileText size={12} /> PDF
              </a>
              {inv.status !== 'paid' && inv.status !== 'void' && (
                <button onClick={() => openPay(inv)} className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-cloud text-steel rounded-lg hover:bg-teal/10 hover:text-teal">
                  <DollarSign size={12} /> Record payment
                </button>
              )}
              <button onClick={() => remove(inv.id)} className="ml-auto text-silver hover:text-ember"><Trash2 size={13} /></button>
            </div>

            {payFor === inv.id && (
              <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end mt-3 pt-3 border-t border-mist">
                <AdminInput label="Amount ($)" value={pay.amount} onChange={v => setPay({ ...pay, amount: v })} />
                <AdminSelect label="Method" value={pay.method} onChange={v => setPay({ ...pay, method: v as PaymentMethod })} options={METHODS} />
                <AdminInput label="Reference" value={pay.reference} onChange={v => setPay({ ...pay, reference: v })} placeholder="optional" />
                <button onClick={() => recordPayment(inv)} className="px-3 py-2.5 bg-teal text-white rounded-lg text-sm hover:bg-teal/90">Save</button>
              </div>
            )}
          </div>
        )
      })}
      {invoices.length === 0 && <div className="text-center text-sm text-silver py-10">No invoices yet. Generate one from an engagement.</div>}
    </div>
  )
}
