import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Loader2, CheckCircle2, Download, PenLine, ShieldCheck, ArrowDown, Mail, KeyRound, Lock, FileCheck2, ChevronDown } from 'lucide-react'
import { api, type ContractPublic, type ContractCertificate } from '../lib/api'

const EVENT_LABELS: Record<string, string> = {
  created: 'Document created', sent: 'Sent for signature', viewed: 'Document viewed',
  otp_sent: 'Verification code sent', email_verified: 'Email verified', signed: 'Signed',
}
const fmtTs = (s?: string | null) => s ? new Date(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'

export default function ContractView() {
  const { token } = useParams<{ token: string }>()
  const [c, setC] = useState<ContractPublic | null>(null)
  const [error, setError] = useState(false)
  const [step, setStep] = useState<'email' | 'code' | 'sign'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [cert, setCert] = useState<ContractCertificate | null>(null)
  const [showAudit, setShowAudit] = useState(false)
  const [docKey, setDocKey] = useState(0)
  const docRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!token) return
    api.crm.public.getContract(token)
      .then(c => { setC(c); if (c.status === 'accepted') api.crm.public.getCertificate(token).then(setCert).catch(() => {}) })
      .catch(() => setError(true))
  }, [token])
  useEffect(() => { if (c) document.title = c.title }, [c])

  const sendCode = async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setMsg('Enter a valid email address'); return }
    setBusy(true); setMsg('')
    try { await api.crm.public.verifyStart(token!, email.trim()); setStep('code'); setMsg(`We sent a 6-digit code to ${email.trim()}.`) }
    catch { setMsg('Could not send the code. Please try again.') }
    finally { setBusy(false) }
  }
  const verifyCode = async () => {
    if (code.trim().length < 6) { setMsg('Enter the 6-digit code'); return }
    setBusy(true); setMsg('')
    try { await api.crm.public.verifyConfirm(token!, email.trim(), code.trim()); setStep('sign'); setMsg('') }
    catch { setMsg('That code is incorrect or expired.') }
    finally { setBusy(false) }
  }
  const sign = async () => {
    if (!name.trim()) return
    setBusy(true); setMsg('')
    try {
      const updated = await api.crm.public.acceptContract(token!, { accepted_name: name.trim(), email: email.trim() })
      setC(updated); setDocKey(k => k + 1)
      api.crm.public.getCertificate(token!).then(setCert).catch(() => {})
      docRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    } catch { setMsg('Could not complete signing. Please re-verify and try again.'); setStep('email') }
    finally { setBusy(false) }
  }

  if (error) return <Shell><span className="font-mono text-sm text-steel tracking-wide">Contract not found or no longer available.</span></Shell>
  if (!c) return <Shell><Loader2 className="animate-spin text-blue" /></Shell>

  const pdfUrl = `${api.crm.public.contractPdfUrl(token!)}?v=${docKey}`
  const signed = c.status === 'accepted'
  const open = c.status === 'sent'

  return (
    <div className="h-screen flex flex-col bg-mist/50 overflow-hidden">
      {/* Top bar */}
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
            {signed && (
              <a href={pdfUrl} download={`${c.title}.pdf`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-ink text-white text-sm font-medium hover:bg-blue transition-colors">
                <Download size={14} /> Download
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Document canvas */}
      <main ref={docRef} className="flex-1 overflow-auto">
        <div className="max-w-[820px] mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl overflow-hidden shadow-[0_24px_70px_-24px_rgba(45,51,66,0.45)] ring-1 ring-mist bg-white">
            <iframe key={docKey} src={pdfUrl} title="Contract document"
              className="w-full block" style={{ height: 'calc(820px * 11 / 8.5)' }} />
          </motion.div>

          {open && (
            <div className="flex flex-col items-center gap-1 text-steel py-6">
              <ArrowDown size={16} className="animate-bounce text-blue" />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em]">Review, then verify &amp; sign below</span>
            </div>
          )}

          {signed && cert && (
            <Certificate cert={cert} showAudit={showAudit} onToggle={() => setShowAudit(v => !v)} />
          )}
        </div>
      </main>

      {/* Action bar */}
      <AnimatePresence mode="wait">
        {open && (
          <motion.footer key="sign"
            initial={{ y: 110 }} animate={{ y: 0 }} exit={{ y: 110 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="shrink-0 bg-white border-t-2 border-blue/20 shadow-[0_-12px_40px_-20px_rgba(45,51,66,0.3)] z-20">
            <div className="max-w-[900px] mx-auto px-5 py-4">
              {/* step indicator */}
              <div className="flex items-center gap-2 mb-3 font-mono text-[10px] uppercase tracking-[0.18em]">
                <Stepi icon={Mail} label="Verify email" active={step === 'email'} done={step !== 'email'} />
                <span className="h-px w-4 bg-mist" />
                <Stepi icon={KeyRound} label="Enter code" active={step === 'code'} done={step === 'sign'} />
                <span className="h-px w-4 bg-mist" />
                <Stepi icon={PenLine} label="Sign" active={step === 'sign'} done={false} />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                {step === 'email' && (
                  <>
                    <div className="flex-1">
                      <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-steel mb-1.5">Your email — we'll send a verification code</label>
                      <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendCode()}
                        type="email" placeholder="you@company.com" autoFocus
                        className="w-full bg-cloud/70 border border-mist rounded-lg px-4 py-3 text-ink placeholder-silver focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10" />
                    </div>
                    <button onClick={sendCode} disabled={busy} className="shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-blue text-white font-medium shadow-lg shadow-blue/25 hover:bg-blue-dim disabled:opacity-40 transition-all">
                      {busy ? <Loader2 size={16} className="animate-spin" /> : <><Mail size={16} /> Send code</>}
                    </button>
                  </>
                )}

                {step === 'code' && (
                  <>
                    <div className="flex-1">
                      <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-steel mb-1.5">Enter the 6-digit code</label>
                      <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} onKeyDown={e => e.key === 'Enter' && verifyCode()}
                        inputMode="numeric" placeholder="000000" autoFocus
                        className="w-44 bg-cloud/70 border border-mist rounded-lg px-4 py-3 text-ink placeholder-silver font-mono text-2xl tracking-[0.4em] focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10" />
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={verifyCode} disabled={busy} className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-blue text-white font-medium shadow-lg shadow-blue/25 hover:bg-blue-dim disabled:opacity-40 transition-all">
                        {busy ? <Loader2 size={16} className="animate-spin" /> : <><ShieldCheck size={16} /> Verify</>}
                      </button>
                      <button onClick={() => { setStep('email'); setCode(''); setMsg('') }} className="text-sm text-steel hover:text-ink">Change email</button>
                    </div>
                  </>
                )}

                {step === 'sign' && (
                  <>
                    <div className="flex-1">
                      <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-steel mb-1.5">
                        <CheckCircle2 size={12} className="text-teal" /> Email verified — type your full legal name to sign
                      </label>
                      <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && sign()}
                        placeholder="Your full name" autoFocus
                        className="w-full bg-cloud/70 border border-mist rounded-lg px-4 py-3 text-ink placeholder-silver focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10"
                        style={{ fontFamily: 'Caveat, cursive', fontSize: '26px', lineHeight: 1.1 }} />
                    </div>
                    <button onClick={sign} disabled={!name.trim() || busy} className="shrink-0 inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-lg bg-blue text-white font-medium shadow-lg shadow-blue/25 hover:bg-blue-dim disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                      {busy ? <Loader2 size={16} className="animate-spin" /> : <><ShieldCheck size={16} /> Adopt &amp; Sign</>}
                    </button>
                  </>
                )}
              </div>

              <p className={`mt-2.5 text-[11px] ${msg ? 'text-blue' : 'text-steel'}`}>
                {msg || (<><Lock size={11} className="inline -mt-0.5 mr-1" />Your email, name, IP address, and timestamps are recorded as your electronic signature. {c.consultant_name} has already signed.</>)}
              </p>
            </div>
          </motion.footer>
        )}

        {signed && (
          <motion.footer key="done" initial={{ y: 90, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="shrink-0 bg-teal/8 border-t border-teal/25 z-20">
            <div className="max-w-[900px] mx-auto px-5 py-4 flex items-center gap-3">
              <CheckCircle2 size={22} className="text-teal shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink">Signed by {c.accepted_name} and {c.consultant_signed_name || c.consultant_name}</div>
                <div className="font-mono text-[10px] text-steel tracking-wide">{c.accepted_at && `Executed ${fmtTs(c.accepted_at)}`}{c.signer_email ? ` · ${c.signer_email}` : ''}</div>
              </div>
              <a href={pdfUrl} download={`${c.title}.pdf`} className="ml-auto inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-ink text-white text-sm font-medium hover:bg-blue transition-colors shrink-0">
                <Download size={15} /> Download PDF
              </a>
            </div>
          </motion.footer>
        )}

        {!open && !signed && (
          <motion.footer key="closed" initial={{ y: 60 }} animate={{ y: 0 }} className="shrink-0 bg-white border-t border-mist z-20">
            <div className="max-w-[900px] mx-auto px-5 py-4 text-sm text-steel">This contract is not currently open for signing.</div>
          </motion.footer>
        )}
      </AnimatePresence>
    </div>
  )
}

function Stepi({ icon: Icon, label, active, done }: { icon: typeof Mail; label: string; active: boolean; done: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${active ? 'text-blue' : done ? 'text-teal' : 'text-silver'}`}>
      {done ? <CheckCircle2 size={13} /> : <Icon size={13} />} {label}
    </span>
  )
}

function Certificate({ cert, showAudit, onToggle }: { cert: ContractCertificate; showAudit: boolean; onToggle: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
      className="mt-6 bg-white rounded-xl ring-1 ring-mist shadow-sm overflow-hidden">
      <div className="px-6 py-5">
        <div className="flex items-center gap-2 text-teal mb-1">
          <FileCheck2 size={16} />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em]">Certificate of completion</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 mt-3">
          <Signer role="Consultant" name={cert.consultant_name} ts={cert.consultant_signed_at} />
          <Signer role="Client" name={cert.client_name} email={cert.signer_email} ts={cert.client_signed_at} />
        </div>
        {cert.document_sha256 && (
          <div className="mt-4 pt-4 border-t border-mist">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-steel mb-1">Document fingerprint · SHA-256</div>
            <div className="font-mono text-[11px] text-ink break-all">{cert.document_sha256}</div>
            <p className="text-[11px] text-steel mt-1.5">Any later change to the terms, parties, or signatures changes this fingerprint, making tampering detectable.</p>
          </div>
        )}
      </div>
      <button onClick={onToggle} className="w-full flex items-center justify-center gap-1.5 py-2.5 border-t border-mist text-xs text-steel hover:text-blue hover:bg-cloud/50 transition-colors">
        {showAudit ? 'Hide' : 'Show'} audit trail ({cert.events.length} events) <ChevronDown size={13} className={`transition-transform ${showAudit ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {showAudit && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-6 py-4 bg-cloud/40 divide-y divide-mist">
              {cert.events.map((e, i) => (
                <div key={i} className="flex items-center gap-3 py-2 text-xs">
                  <span className="font-mono text-[10px] text-steel w-40 shrink-0">{fmtTs(e.occurred_at)}</span>
                  <span className="text-ink flex-1">{EVENT_LABELS[e.type] || e.type}</span>
                  <span className="text-steel truncate max-w-[40%]">{e.actor_name || e.actor_email || ''}</span>
                  <span className="font-mono text-[10px] text-silver shrink-0">{e.ip || ''}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function Signer({ role, name, email, ts }: { role: string; name?: string | null; email?: string | null; ts?: string | null }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-steel mb-0.5">{role}</div>
      <div className="text-sm font-medium text-ink" style={{ fontFamily: 'Caveat, cursive', fontSize: '20px' }}>{name || '—'}</div>
      {email && <div className="font-mono text-[10px] text-steel">{email}</div>}
      <div className="font-mono text-[10px] text-steel">{ts ? `Signed ${fmtTs(ts)}` : 'Pending'}</div>
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
