import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Loader2, CheckCircle2, Download, PenLine, ShieldCheck, ArrowDown } from 'lucide-react'
import { api, type ContractPublic } from '../lib/api'

export default function ContractView() {
  const { token } = useParams<{ token: string }>()
  const [c, setC] = useState<ContractPublic | null>(null)
  const [error, setError] = useState(false)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [docKey, setDocKey] = useState(0)          // bump to reload the embedded PDF
  const docRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!token) return
    api.crm.public.getContract(token).then(c => { setC(c); setName(c.accepted_name || '') }).catch(() => setError(true))
  }, [token])

  useEffect(() => { if (c) document.title = c.title }, [c])

  const sign = async () => {
    if (!token || !name.trim()) return
    setSubmitting(true)
    try {
      const updated = await api.crm.public.acceptContract(token, { accepted_name: name.trim() })
      setC(updated)
      setDocKey(k => k + 1)                          // re-render PDF with both signatures
      docRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    } catch { setError(true) }
    finally { setSubmitting(false) }
  }

  if (error) return <Shell><span className="font-mono text-sm text-steel tracking-wide">Contract not found or no longer available.</span></Shell>
  if (!c) return <Shell><Loader2 className="animate-spin text-blue" /></Shell>

  const pdfUrl = `${api.crm.public.contractPdfUrl(token!)}?v=${docKey}`
  const signed = c.status === 'accepted'
  const open = c.status === 'sent'

  return (
    <div className="h-screen flex flex-col bg-mist/50 overflow-hidden">
      {/* ── Top bar ── */}
      <header className="shrink-0 bg-white border-b border-mist z-20">
        <div className="max-w-[900px] mx-auto px-5 h-16 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue flex items-center justify-center shrink-0">
            <span className="font-mono text-white text-xs font-bold">NB</span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-ink truncate leading-tight">{c.title}</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-steel">
              {signed ? 'Executed agreement' : 'Consulting agreement'} · from {c.consultant_name}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <StatusChip status={c.status} />
            {(signed) && (
              <a href={pdfUrl} download={`${c.title}.pdf`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink text-white text-sm font-medium hover:bg-blue transition-colors">
                <Download size={14} /> Download
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ── Document canvas ── */}
      <main ref={docRef} className="flex-1 overflow-auto">
        <div className="max-w-[820px] mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl overflow-hidden shadow-[0_24px_70px_-24px_rgba(45,51,66,0.45)] ring-1 ring-mist bg-white">
            <iframe key={docKey} src={pdfUrl} title="Contract document"
              className="w-full block" style={{ height: 'calc(820px * 11 / 8.5)' }} />
          </motion.div>

          {open && (
            <div className="flex flex-col items-center gap-1 text-steel py-6 print:hidden">
              <ArrowDown size={16} className="animate-bounce text-blue" />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em]">Review, then sign below</span>
            </div>
          )}
        </div>
      </main>

      {/* ── Signing bar ── */}
      <AnimatePresence mode="wait">
        {open && (
          <motion.footer key="sign"
            initial={{ y: 90 }} animate={{ y: 0 }} exit={{ y: 90 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="shrink-0 bg-white border-t-2 border-blue/20 shadow-[0_-12px_40px_-20px_rgba(45,51,66,0.3)] z-20">
            <div className="max-w-[900px] mx-auto px-5 py-4 flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="flex-1">
                <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-steel mb-2">
                  <PenLine size={12} className="text-blue" /> Sign here — type your full legal name
                </label>
                <div className="relative">
                  <input
                    value={name} onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sign()}
                    placeholder="Your full name" autoFocus
                    className="w-full bg-cloud/70 border border-mist rounded-lg pl-4 pr-4 py-3 text-ink placeholder-silver focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all"
                    style={{ fontFamily: 'Caveat, cursive', fontSize: '26px', lineHeight: 1.1 }}
                  />
                  {!name && <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-mono text-[10px] uppercase tracking-wider text-silver">Signature</span>}
                </div>
              </div>
              <button
                onClick={sign} disabled={!name.trim() || submitting}
                className="shrink-0 inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-lg bg-blue text-white font-medium shadow-lg shadow-blue/25 hover:bg-blue-dim disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <><ShieldCheck size={16} /> Adopt &amp; Sign</>}
              </button>
            </div>
            <p className="max-w-[900px] mx-auto px-5 pb-3 text-[11px] text-steel">
              By signing, you agree to the terms above. Your name, the date, and your IP address are recorded as your electronic signature. {c.consultant_name} has already signed.
            </p>
          </motion.footer>
        )}

        {signed && (
          <motion.footer key="done"
            initial={{ y: 90, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="shrink-0 bg-teal/8 border-t border-teal/25 z-20">
            <div className="max-w-[900px] mx-auto px-5 py-4 flex items-center gap-3">
              <CheckCircle2 size={22} className="text-teal shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink">
                  Signed by {c.accepted_name} and {c.consultant_signed_name || c.consultant_name}
                </div>
                <div className="font-mono text-[10px] text-steel tracking-wide">
                  {c.accepted_at && `Executed ${new Date(c.accepted_at).toLocaleString()}`}
                </div>
              </div>
              <a href={pdfUrl} download={`${c.title}.pdf`}
                className="ml-auto inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-ink text-white text-sm font-medium hover:bg-blue transition-colors shrink-0">
                <Download size={15} /> Download PDF
              </a>
            </div>
          </motion.footer>
        )}

        {!open && !signed && (
          <motion.footer key="closed" initial={{ y: 60 }} animate={{ y: 0 }}
            className="shrink-0 bg-white border-t border-mist z-20">
            <div className="max-w-[900px] mx-auto px-5 py-4 text-sm text-steel">This contract is not currently open for signing.</div>
          </motion.footer>
        )}
      </AnimatePresence>
    </div>
  )
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; dot: string }> = {
    sent: { label: 'Awaiting your signature', cls: 'text-blue bg-blue-wash', dot: 'bg-blue' },
    accepted: { label: 'Executed', cls: 'text-teal bg-teal/10', dot: 'bg-teal' },
    draft: { label: 'Draft', cls: 'text-steel bg-cloud', dot: 'bg-silver' },
    declined: { label: 'Declined', cls: 'text-ember bg-ember/10', dot: 'bg-ember' },
    void: { label: 'Void', cls: 'text-silver bg-cloud', dot: 'bg-silver' },
  }
  const s = map[status] ?? map.draft
  return (
    <span className={`hidden sm:inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} /> {s.label}
    </span>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-cloud flex items-center justify-center">{children}</div>
}
