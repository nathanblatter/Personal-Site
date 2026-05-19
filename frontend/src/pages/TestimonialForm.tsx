import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

const API_BASE = '/api/v1'

interface RequestPublic {
  slug: string
  requester_name: string
  requester_role?: string
  personal_message?: string
  status: string
}

type PageState = 'loading' | 'form' | 'submitted' | 'done' | 'notfound'

export default function TestimonialForm() {
  const { slug } = useParams<{ slug: string }>()
  const [pageState, setPageState] = useState<PageState>('loading')
  const [req, setReq] = useState<RequestPublic | null>(null)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [quote, setQuote] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    fetch(`${API_BASE}/testimonial/${slug}`)
      .then(res => {
        if (res.status === 404) { setPageState('notfound'); return null }
        return res.json()
      })
      .then((data: RequestPublic | null) => {
        if (!data) return
        setReq(data)
        if (data.status === 'submitted') {
          setPageState('submitted')
        } else {
          setName(data.requester_name)
          setRole(data.requester_role ?? '')
          setPageState('form')
        }
      })
      .catch(() => setPageState('notfound'))
  }, [slug])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!quote.trim()) { setError('Please write a testimonial before submitting.'); return }
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/testimonial/${slug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, role, quote, avatar_url: avatarUrl || null }),
      })
      if (res.status === 409) { setPageState('submitted'); return }
      if (!res.ok) throw new Error('Submission failed')
      setPageState('done')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const firstName = req?.requester_name?.split(' ')[0] ?? 'there'

  return (
    <div className="min-h-screen bg-snow flex flex-col items-center justify-center px-4 py-16">
      {/* Logo / wordmark */}
      <a
        href="https://nathanblatter.com"
        className="mb-10 font-mono text-xs text-steel tracking-widest uppercase hover:text-ink transition-colors"
      >
        nathanblatter.com
      </a>

      <div className="w-full max-w-lg">
        {pageState === 'loading' && (
          <div className="text-center">
            <div className="w-6 h-6 border-2 border-blue border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-steel font-mono text-sm">Loading…</p>
          </div>
        )}

        {pageState === 'notfound' && (
          <div className="text-center">
            <p className="font-mono text-xs text-blue uppercase tracking-widest mb-3">Not found</p>
            <h1 className="text-2xl font-sans font-semibold text-ink mb-2">This link isn't active</h1>
            <p className="text-steel text-sm">The testimonial request may have already been completed or the link is invalid.</p>
          </div>
        )}

        {pageState === 'submitted' && (
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-blue-wash flex items-center justify-center mx-auto mb-5">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="font-mono text-xs text-blue uppercase tracking-widest mb-3">Already submitted</p>
            <h1 className="text-2xl font-sans font-semibold text-ink mb-2">Thanks {firstName}!</h1>
            <p className="text-steel text-sm">Your testimonial has already been received. I'll review it shortly.</p>
          </div>
        )}

        {pageState === 'done' && (
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5 border border-emerald-200">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="font-mono text-xs text-blue uppercase tracking-widest mb-3">Testimonial received</p>
            <h1 className="text-2xl font-sans font-semibold text-ink mb-2">Thank you, {firstName}!</h1>
            <p className="text-steel text-sm leading-relaxed">
              Your words mean a lot. I'll review your testimonial and reach out if I have any questions.
            </p>
          </div>
        )}

        {pageState === 'form' && req && (
          <div className="bg-white rounded-2xl border border-mist shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-8 pt-8 pb-6 border-b border-mist">
              <p className="font-mono text-xs text-blue uppercase tracking-widest mb-3">Testimonial Request</p>
              <h1 className="text-2xl font-sans font-semibold text-ink mb-1">
                Hey {firstName} 👋
              </h1>
              <p className="text-steel text-sm leading-relaxed">
                I'd love a few kind words from you — it only takes a couple of minutes.
              </p>

              {req.personal_message && (
                <blockquote className="mt-4 pl-4 border-l-2 border-blue/30 italic text-sm text-ink/70 leading-relaxed">
                  &ldquo;{req.personal_message}&rdquo;
                  <span className="block not-italic text-xs text-steel mt-1 font-mono">— Nathan</span>
                </blockquote>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-xs text-steel uppercase tracking-wider mb-1.5">
                    Your name
                  </label>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    placeholder="Jane Smith"
                    className="w-full px-3 py-2.5 text-sm text-ink bg-snow border border-mist rounded-lg focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue/40 transition-all"
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs text-steel uppercase tracking-wider mb-1.5">
                    Your role / title
                  </label>
                  <input
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    placeholder="Senior Engineer at Acme"
                    className="w-full px-3 py-2.5 text-sm text-ink bg-snow border border-mist rounded-lg focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue/40 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-xs text-steel uppercase tracking-wider mb-1.5">
                  Your testimonial <span className="text-blue">*</span>
                </label>
                <textarea
                  value={quote}
                  onChange={e => setQuote(e.target.value)}
                  required
                  rows={5}
                  placeholder="Share what it was like working with Nathan, what stood out, or what you'd tell someone considering working with him…"
                  className="w-full px-3 py-2.5 text-sm text-ink bg-snow border border-mist rounded-lg focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue/40 transition-all resize-none"
                />
                <p className="mt-1 text-xs text-silver font-mono">{quote.length} characters</p>
              </div>

              <div>
                <label className="block font-mono text-xs text-steel uppercase tracking-wider mb-1.5">
                  Photo URL <span className="text-silver">(optional)</span>
                </label>
                <input
                  value={avatarUrl}
                  onChange={e => setAvatarUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/… or leave blank"
                  className="w-full px-3 py-2.5 text-sm text-ink bg-snow border border-mist rounded-lg focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue/40 transition-all font-mono text-xs"
                />
                <p className="mt-1 text-xs text-silver font-mono">A headshot or LinkedIn photo URL — or just leave it blank.</p>
              </div>

              {error && (
                <p className="text-xs text-ember font-mono bg-ember/5 border border-ember/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-blue text-white font-mono text-sm font-semibold rounded-xl hover:bg-blue-dim active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting…
                  </>
                ) : (
                  'Submit Testimonial'
                )}
              </button>

              <p className="text-center text-xs text-silver font-mono">
                Your testimonial will be reviewed before appearing on the site.
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
