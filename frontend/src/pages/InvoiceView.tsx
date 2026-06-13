import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Printer, Loader2 } from 'lucide-react'
import { api, type InvoicePublic } from '../lib/api'

function money(cents: number, currency = 'USD') {
  const sym = currency === 'USD' ? '$' : `${currency} `
  return `${sym}${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

const STATUS_COLORS: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-700', sent: 'bg-blue-100 text-blue-700',
  partial: 'bg-amber-100 text-amber-700', overdue: 'bg-rose-100 text-rose-700',
  draft: 'bg-slate-100 text-slate-600', void: 'bg-slate-100 text-slate-400',
}

export default function InvoiceView() {
  const { token } = useParams<{ token: string }>()
  const [inv, setInv] = useState<InvoicePublic | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!token) return
    api.crm.public.getInvoice(token).then(setInv).catch(() => setError(true))
  }, [token])

  useEffect(() => { if (inv) document.title = `Invoice ${inv.number}` }, [inv])

  if (error) return <Centered>Invoice not found.</Centered>
  if (!inv) return <Centered><Loader2 className="animate-spin text-blue-500" /></Centered>

  const balance = inv.total_cents - inv.amount_paid_cents

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4 print:bg-white print:py-0">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-end mb-4 print:hidden">
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm hover:bg-slate-800">
            <Printer size={15} /> Print / Save PDF
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 print:shadow-none print:border-0">
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{inv.consultant_name}</h1>
              <p className="text-sm text-slate-500">{inv.consultant_email}</p>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-blue-600">INVOICE</div>
              <span className={`inline-block mt-1 text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_COLORS[inv.status]}`}>{inv.status}</span>
            </div>
          </div>

          <div className="flex justify-between mb-8 text-sm">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1">Bill to</div>
              <div className="font-medium text-slate-900">{inv.bill_to_name || '—'}</div>
              {inv.bill_to_company && <div className="text-slate-500">{inv.bill_to_company}</div>}
            </div>
            <div className="text-right space-y-0.5">
              <Row label="Invoice #" value={inv.number} />
              <Row label="Issued" value={fmtDate(inv.issue_date)} />
              <Row label="Due" value={fmtDate(inv.due_date)} />
            </div>
          </div>

          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-mono uppercase tracking-wider text-slate-400">
                <th className="text-left py-2 font-normal">Description</th>
                <th className="text-right py-2 font-normal">Qty</th>
                <th className="text-right py-2 font-normal">Rate</th>
                <th className="text-right py-2 font-normal">Amount</th>
              </tr>
            </thead>
            <tbody>
              {inv.line_items.map((li, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2.5 text-slate-700">{li.description}</td>
                  <td className="py-2.5 text-right text-slate-500">{li.quantity}</td>
                  <td className="py-2.5 text-right text-slate-500">{money(li.unit_price_cents, inv.currency)}</td>
                  <td className="py-2.5 text-right text-slate-900">{money(li.amount_cents, inv.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-56 space-y-1.5 text-sm">
              <Row label="Subtotal" value={money(inv.subtotal_cents, inv.currency)} />
              {inv.tax_cents > 0 && <Row label="Tax" value={money(inv.tax_cents, inv.currency)} />}
              <div className="flex justify-between border-t border-slate-200 pt-1.5 font-semibold text-slate-900">
                <span>Total</span><span className="text-blue-600">{money(inv.total_cents, inv.currency)}</span>
              </div>
              {inv.amount_paid_cents > 0 && (
                <>
                  <Row label="Paid" value={`-${money(inv.amount_paid_cents, inv.currency)}`} />
                  <div className="flex justify-between font-semibold text-slate-900"><span>Balance due</span><span>{money(balance, inv.currency)}</span></div>
                </>
              )}
            </div>
          </div>

          {inv.notes && (
            <div className="mt-8 pt-6 border-t border-slate-100">
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1">Notes</div>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">{inv.notes}</p>
            </div>
          )}

          {balance > 0 && inv.status !== 'void' && (
            <div className="mt-6 p-4 bg-blue-50 rounded-xl text-sm text-blue-800">
              Payment accepted via Venmo. Please reference invoice <strong>{inv.number}</strong> when paying.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-6"><span className="text-slate-400">{label}</span><span className="text-slate-700">{value}</span></div>
}
function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-500">{children}</div>
}
