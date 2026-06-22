import { useState } from 'react'
import { Mail, Check, Loader2 } from 'lucide-react'
import { api } from '../lib/api'

type Status = 'idle' | 'loading' | 'done' | 'error'

export default function NewsletterSignup() {
  const [email, setEmail] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (status === 'loading') return
    setStatus('loading')
    setError('')
    try {
      await api.newsletter.subscribe(email.trim(), honeypot)
      setStatus('done')
      setEmail('')
    } catch {
      setStatus('error')
      setError('Something went wrong. Please try again.')
    }
  }

  return (
    <div className="rounded-2xl border border-mist bg-snow p-8 md:p-10">
      <div className="flex items-center gap-2 mb-2">
        <Mail size={15} className="text-blue" />
        <span className="font-mono text-xs text-blue tracking-widest uppercase">Newsletter</span>
      </div>
      <h2 className="text-2xl font-sans font-semibold text-ink mb-2">
        Get new posts in your inbox
      </h2>
      <p className="text-steel text-sm max-w-md mb-6">
        Occasional writing on software, AI, and what I'm building. No spam, unsubscribe anytime.
      </p>

      {status === 'done' ? (
        <div className="flex items-center gap-2.5 text-teal font-mono text-sm">
          <Check size={16} />
          You're subscribed — thanks for reading.
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col sm:flex-row gap-3 max-w-md">
          {/* Honeypot — hidden from humans */}
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={e => setHoneypot(e.target.value)}
            className="hidden"
            aria-hidden="true"
          />
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="flex-1 px-4 py-2.5 text-sm font-mono bg-white border border-mist rounded-lg text-ink placeholder:text-silver focus:outline-none focus:border-blue/40 focus:ring-1 focus:ring-blue/20 transition-colors"
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue text-white font-mono text-xs tracking-wider hover:bg-blue-dim transition-colors disabled:opacity-60"
          >
            {status === 'loading' ? <Loader2 size={14} className="animate-spin" /> : null}
            Subscribe
          </button>
        </form>
      )}
      {status === 'error' && (
        <p className="text-ember font-mono text-xs mt-3">{error}</p>
      )}
    </div>
  )
}
