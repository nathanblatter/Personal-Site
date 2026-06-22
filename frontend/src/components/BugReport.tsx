import { useEffect, useRef, useState } from 'react'
import { Bug, Check } from 'lucide-react'

const SEVERITIES = [
  { value: 'low', label: 'Minor — cosmetic' },
  { value: 'med', label: 'Medium — gets in the way' },
  { value: 'high', label: 'High — hard to use' },
  { value: 'urgent', label: 'Urgent — broken' },
]

type Status = 'idle' | 'sending' | 'sent' | 'error'

export default function BugReport() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [severity, setSeverity] = useState('med')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    const id = window.setTimeout(() => ref.current?.focus(), 40)
    return () => { document.removeEventListener('keydown', onKey); window.clearTimeout(id) }
  }, [open])

  function close() {
    setOpen(false)
    window.setTimeout(() => { setMessage(''); setSeverity('med'); setStatus('idle'); setError('') }, 200)
  }

  async function send() {
    const trimmed = message.trim()
    if (!trimmed) { setError('Add a quick description first.'); ref.current?.focus(); return }
    setStatus('sending'); setError('')
    try {
      const res = await fetch('/api/v1/bug-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          severity,
          url: window.location.href,
          meta: { path: window.location.pathname, viewport: `${window.innerWidth}x${window.innerHeight}`, userAgent: navigator.userAgent },
        }),
      })
      if (!res.ok) throw new Error()
      setStatus('sent')
      window.setTimeout(close, 1300)
    } catch {
      setStatus('error'); setError('Could not send. Please try again.')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Report a bug"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-blue px-4 py-3
                   font-mono text-xs tracking-wider text-white shadow-lg shadow-blue/25 transition
                   hover:-translate-y-0.5 hover:bg-blue-dim focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-glow"
      >
        <Bug size={15} />
        <span className="hidden sm:inline">Report a bug</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/50 p-4 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}
        >
          <div role="dialog" aria-modal="true" aria-label="Report a bug"
               className="w-full max-w-md rounded-2xl border border-mist bg-white p-6 shadow-2xl">
            <h2 className="font-serif text-3xl leading-none text-ink">Spotted a bug?</h2>
            <p className="mt-1.5 font-sans text-sm text-steel">
              Tell me what happened — it goes straight to my board.
            </p>

            {status === 'sent' ? (
              <div className="mt-6 flex items-center gap-2 rounded-xl bg-blue-wash px-4 py-6 text-blue">
                <Check size={18} />
                <span className="font-sans text-sm">Thanks — your report was filed.</span>
              </div>
            ) : (
              <>
                <label htmlFor="ps-bug-msg" className="mt-5 block font-mono text-[11px] uppercase tracking-wider text-steel">
                  What went wrong?
                </label>
                <textarea id="ps-bug-msg" ref={ref} value={message} onChange={(e) => setMessage(e.target.value)}
                  rows={4} maxLength={5000} placeholder="What you saw, and what you expected…"
                  className="mt-2 w-full resize-y rounded-lg border border-mist bg-snow p-3 font-sans text-sm text-ink
                             placeholder-silver focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/20" />

                <label htmlFor="ps-bug-sev" className="mt-4 block font-mono text-[11px] uppercase tracking-wider text-steel">
                  How bad is it?
                </label>
                <select id="ps-bug-sev" value={severity} onChange={(e) => setSeverity(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-mist bg-snow p-2.5 font-sans text-sm text-ink focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/20">
                  {SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>

                <div className="mt-5 flex items-center gap-3">
                  <span className="mr-auto font-sans text-xs text-ember">{error}</span>
                  <button type="button" onClick={close} className="font-mono text-xs tracking-wider text-steel transition hover:text-ink">Cancel</button>
                  <button type="button" onClick={send} disabled={status === 'sending'}
                    className="rounded-lg bg-blue px-4 py-2 font-mono text-xs tracking-wider text-white transition hover:bg-blue-dim disabled:opacity-60">
                    {status === 'sending' ? 'Sending…' : 'Send report'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
