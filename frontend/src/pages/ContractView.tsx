import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { api, type ContractPublic } from '../lib/api'

function money(cents?: number | null, currency = 'USD') {
  if (cents == null) return null
  const sym = currency === 'USD' ? '$' : `${currency} `
  return `${sym}${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function ContractView() {
  const { token } = useParams<{ token: string }>()
  const [c, setC] = useState<ContractPublic | null>(null)
  const [error, setError] = useState(false)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) return
    api.crm.public.getContract(token).then(setC).catch(() => setError(true))
  }, [token])

  useEffect(() => { if (c) document.title = c.title }, [c])

  const accept = async () => {
    if (!token || !name.trim()) return
    setSubmitting(true)
    try { setC(await api.crm.public.acceptContract(token, { accepted_name: name.trim() })) }
    catch { setError(true) }
    finally { setSubmitting(false) }
  }

  if (error) return <Centered>Contract not found.</Centered>
  if (!c) return <Centered><Loader2 className="animate-spin text-blue-500" /></Centered>

  const total = money(c.total_value_cents, c.currency)

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-10">
        <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1">Agreement from {c.consultant_name}</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-6">{c.title}</h1>

        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm mb-6 pb-6 border-b border-slate-100">
          {total && <Meta label="Value" value={total} />}
          {c.start_date && <Meta label="Start" value={fmtDate(c.start_date)} />}
          {c.end_date && <Meta label="End" value={fmtDate(c.end_date)} />}
        </div>

        {c.scope_md && <Block title="Scope" body={c.scope_md} />}
        {c.terms_md && <Block title="Terms" body={c.terms_md} />}

        {c.status === 'accepted' ? (
          <div className="mt-8 p-5 bg-emerald-50 rounded-xl flex items-center gap-3 text-emerald-800">
            <CheckCircle2 size={20} />
            <div>
              <div className="font-medium">Accepted{c.accepted_name ? ` by ${c.accepted_name}` : ''}</div>
              {c.accepted_at && <div className="text-sm text-emerald-600">{new Date(c.accepted_at).toLocaleString()}</div>}
            </div>
          </div>
        ) : c.status === 'sent' ? (
          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">Accept this agreement</div>
            <p className="text-sm text-slate-500 mb-3">Type your full name to accept. This records your name, the date, and your IP as your electronic signature.</p>
            <div className="flex gap-2">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Your full name"
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
              <button onClick={accept} disabled={!name.trim() || submitting}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {submitting ? <Loader2 size={15} className="animate-spin" /> : 'Accept'}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-8 text-sm text-slate-400">This contract is not currently open for acceptance.</div>
        )}
      </div>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">{label}</div><div className="text-slate-900 font-medium">{value}</div></div>
}
function Block({ title, body }: { title: string; body: string }) {
  return (
    <div className="mb-6">
      <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">{title}</div>
      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{body}</p>
    </div>
  )
}
function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-500">{children}</div>
}
