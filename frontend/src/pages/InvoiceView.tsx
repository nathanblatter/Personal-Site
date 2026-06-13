import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { Printer, Loader2 } from 'lucide-react'
import { api, type InvoicePublic } from '../lib/api'

function money(cents: number, currency = 'USD') {
  const sym = currency === 'USD' ? '$' : `${currency} `
  return `${sym}${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const STATUS: Record<string, { label: string; dot: string; text: string }> = {
  paid: { label: 'Paid', dot: 'bg-teal', text: 'text-teal' },
  sent: { label: 'Sent', dot: 'bg-blue', text: 'text-blue' },
  partial: { label: 'Partially paid', dot: 'bg-violet', text: 'text-violet' },
  overdue: { label: 'Overdue', dot: 'bg-ember', text: 'text-ember' },
  draft: { label: 'Draft', dot: 'bg-silver', text: 'text-steel' },
  void: { label: 'Void', dot: 'bg-silver', text: 'text-silver' },
}

export default function InvoiceView() {
  const { token } = useParams<{ token: string }>()
  const [inv, setInv] = useState<InvoicePublic | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!token) return
    api.crm.public.getInvoice(token).then(setInv).catch(() => setError(true))
  }, [token])

  useEffect(() => { if (inv) document.title = `Invoice ${inv.number} — Nathan Blatter` }, [inv])

  if (error) return <Shell><span className="font-mono text-sm text-steel tracking-wide">Invoice not found.</span></Shell>
  if (!inv) return <Shell><Loader2 className="animate-spin text-blue" /></Shell>

  const balance = inv.total_cents - inv.amount_paid_cents
  const st = STATUS[inv.status] ?? STATUS.sent
  const showStamp = inv.status === 'paid' || inv.status === 'overdue'

  const ease = [0.16, 1, 0.3, 1] as const
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease },
  })

  return (
    <div className="invoice-page min-h-screen bg-cloud text-ink relative overflow-x-hidden">
      <PrintStyles />

      {/* dotted atmosphere — screen only */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.5] print:hidden" style={{
        backgroundImage: 'radial-gradient(circle, var(--color-mist) 1px, transparent 1px)',
        backgroundSize: '26px 26px',
      }} />
      <div className="pointer-events-none fixed top-[-10%] right-[-5%] w-[600px] h-[600px] bg-blue/[0.05] rounded-full blur-[140px] print:hidden" />

      {/* toolbar */}
      <div className="no-print sticky top-0 z-20 flex justify-center px-4 pt-6">
        <div className="w-full max-w-[760px] flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-steel">Invoice · {inv.number}</span>
          <button onClick={() => window.print()}
            className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-ink text-white text-sm font-medium shadow-lg shadow-ink/15 hover:bg-blue transition-colors">
            <Printer size={15} className="group-hover:scale-110 transition-transform" /> Save as PDF
          </button>
        </div>
      </div>

      {/* the sheet */}
      <div className="relative z-10 flex justify-center px-4 py-8 print:p-0">
        <motion.article
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }}
          className="invoice-sheet w-full max-w-[760px] bg-white rounded-[20px] shadow-[0_30px_80px_-30px_rgba(45,51,66,0.35)] ring-1 ring-mist/70 overflow-hidden print:shadow-none print:ring-0 print:rounded-none">

          {/* accent ribbon */}
          <div className="h-1.5 bg-gradient-to-r from-blue-dim via-blue to-blue-glow" />

          <div className="relative px-10 sm:px-14 py-12 sm:py-14">
            {/* status stamp */}
            {showStamp && (
              <motion.div
                initial={{ opacity: 0, scale: 1.3, rotate: -18 }} animate={{ opacity: 1, scale: 1, rotate: -14 }}
                transition={{ duration: 0.6, delay: 0.5, ease }}
                className={`absolute top-12 right-10 sm:right-14 select-none ${inv.status === 'paid' ? 'text-teal' : 'text-ember'}`}>
                <span className={`block font-serif italic text-5xl sm:text-6xl leading-none border-[3px] ${inv.status === 'paid' ? 'border-teal' : 'border-ember'} rounded-2xl px-5 py-1.5 opacity-15`}>
                  {inv.status === 'paid' ? 'Paid' : 'Overdue'}
                </span>
              </motion.div>
            )}

            {/* letterhead */}
            <motion.header {...rise(0.1)} className="mb-12">
              <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-blue mb-2">Invoice</div>
              <h1 className="font-serif text-5xl sm:text-6xl leading-[0.95] text-ink">
                Nathan <span className="italic text-gradient-blue">Blatter</span>
              </h1>
              <p className="mt-2 font-mono text-xs text-steel tracking-wide">{inv.consultant_email}</p>
            </motion.header>

            {/* meta grid */}
            <motion.section {...rise(0.18)} className="grid grid-cols-2 sm:grid-cols-4 gap-y-7 gap-x-6 mb-10 pb-10 border-b border-mist">
              <Field label="Billed to" wide>
                <div className="font-medium text-ink">{inv.bill_to_name || '—'}</div>
                {inv.bill_to_company && <div className="text-steel text-sm">{inv.bill_to_company}</div>}
              </Field>
              <Field label="Invoice №"><span className="font-mono text-sm">{inv.number}</span></Field>
              <Field label="Status">
                <span className={`inline-flex items-center gap-1.5 ${st.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                  <span className="text-sm font-medium">{st.label}</span>
                </span>
              </Field>
              <Field label="Issued"><span className="text-sm text-slate">{fmtDate(inv.issue_date)}</span></Field>
              <Field label="Due"><span className="text-sm text-slate">{fmtDate(inv.due_date)}</span></Field>
            </motion.section>

            {/* line items */}
            <motion.section {...rise(0.26)} className="mb-2">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-6 sm:gap-x-10 pb-3 mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-steel">
                <span>Description</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Rate</span>
                <span className="text-right">Amount</span>
              </div>
              {inv.line_items.map((li, i) => (
                <div key={i} className="invoice-row grid grid-cols-[1fr_auto_auto_auto] gap-x-6 sm:gap-x-10 py-4 border-t border-mist/80 items-baseline">
                  <span className="text-[15px] text-ink leading-snug">{li.description}</span>
                  <span className="text-right font-mono text-sm text-steel tabular-nums">{li.quantity}</span>
                  <span className="text-right font-mono text-sm text-steel tabular-nums">{money(li.unit_price_cents, inv.currency)}</span>
                  <span className="text-right font-mono text-sm text-ink tabular-nums">{money(li.amount_cents, inv.currency)}</span>
                </div>
              ))}
            </motion.section>

            {/* totals */}
            <motion.section {...rise(0.34)} className="flex justify-end mt-8">
              <div className="w-full sm:w-[300px]">
                <Total label="Subtotal" value={money(inv.subtotal_cents, inv.currency)} />
                {inv.tax_cents > 0 && <Total label="Tax" value={money(inv.tax_cents, inv.currency)} />}
                {inv.amount_paid_cents > 0 && <Total label="Paid" value={`−${money(inv.amount_paid_cents, inv.currency)}`} />}

                <div className="mt-4 pt-5 border-t-2 border-ink/90 flex items-end justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-steel mb-1.5">
                    {inv.amount_paid_cents > 0 && balance > 0 ? 'Balance due' : balance <= 0 ? 'Paid in full' : 'Amount due'}
                  </span>
                  <span className={`font-serif italic text-[42px] leading-none ${balance <= 0 ? 'text-teal' : 'text-gradient-blue'}`}>
                    {money(Math.max(balance, 0), inv.currency)}
                  </span>
                </div>
              </div>
            </motion.section>

            {/* notes + payment */}
            <motion.footer {...rise(0.42)} className="mt-14 pt-8 border-t border-mist grid sm:grid-cols-2 gap-8">
              <div>
                {inv.notes && (
                  <>
                    <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-steel mb-2">Notes</div>
                    <p className="text-sm text-slate leading-relaxed whitespace-pre-wrap">{inv.notes}</p>
                  </>
                )}
              </div>
              {balance > 0 && inv.status !== 'void' && (
                <div className="rounded-2xl bg-blue-wash/70 ring-1 ring-blue/10 p-5 print:bg-blue-wash">
                  <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-blue mb-1.5">Payment</div>
                  <p className="text-sm text-slate leading-relaxed">
                    Payable via <span className="font-medium text-ink">Venmo</span>. Please reference invoice
                    {' '}<span className="font-mono text-ink">{inv.number}</span> with your payment.
                  </p>
                </div>
              )}
            </motion.footer>

            <motion.p {...rise(0.5)} className="mt-12 text-center font-serif italic text-lg text-steel">
              Thank you for your business.
            </motion.p>
          </div>
        </motion.article>
      </div>
    </div>
  )
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-steel mb-1.5">{label}</div>
      {children}
    </div>
  )
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-steel">{label}</span>
      <span className="font-mono text-ink tabular-nums">{value}</span>
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-cloud flex items-center justify-center">{children}</div>
}

function PrintStyles() {
  return (
    <style>{`
      @media print {
        @page { size: A4; margin: 14mm; }
        html, body { background: #fff !important; }
        .no-print { display: none !important; }
        .invoice-page { background: #fff !important; }
        .invoice-sheet { max-width: none !important; }
        .invoice-row { break-inside: avoid; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      }
    `}</style>
  )
}
