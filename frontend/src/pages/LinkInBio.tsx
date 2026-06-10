import { useEffect, useState, useCallback } from 'react'
import { motion } from 'motion/react'
import { AlertCircle, RefreshCw, User, ArrowUpRight, Star, Calendar, ArrowRight } from 'lucide-react'
import { getIcon } from '../lib/iconMap'
import type { BioPagePublicResponse, BioLinkResponse } from '../lib/api'

type BioData = BioPagePublicResponse

function trackClick(id: number) {
  fetch(`/api/v1/bio/click/${id}`, { method: 'POST' }).catch(() => {})
}

/* ─── Skeleton loader ─── */
function LoadingSkeleton() {
  return (
    <div className="min-h-dvh bg-snow flex items-center justify-center">
      <div className="w-full max-w-md px-6 py-16 flex flex-col items-center gap-6">
        <div className="w-24 h-24 rounded-full bg-mist animate-pulse" />
        <div className="w-48 h-8 rounded-lg bg-mist animate-pulse" />
        <div className="w-32 h-4 rounded bg-mist animate-pulse" />
        <div className="w-full flex flex-col gap-3 mt-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-full h-16 rounded-2xl bg-mist animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Error state ─── */
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="min-h-dvh bg-snow flex items-center justify-center">
      <div className="text-center px-6">
        <div className="w-14 h-14 rounded-full bg-mist flex items-center justify-center mx-auto mb-5">
          <AlertCircle size={24} className="text-steel" />
        </div>
        <h2 className="font-serif italic text-xl text-ink mb-2">Something went wrong</h2>
        <p className="text-steel text-sm mb-6">Could not load link data. Please try again.</p>
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue text-white font-mono text-sm rounded-xl hover:bg-blue-dim transition-colors"
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    </div>
  )
}

/* ─── Link button ─── */
function LinkButton({ link, index }: { link: BioLinkResponse; index: number }) {
  const Icon = link.icon ? getIcon(link.icon) : null

  return (
    <motion.a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackClick(link.id)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 + index * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`group flex items-center gap-4 w-full px-5 py-4 rounded-2xl border transition-all duration-200 cursor-pointer
        hover:shadow-md hover:-translate-y-0.5 hover:border-blue/30
        ${link.featured
          ? 'bg-blue-wash border-blue/20'
          : 'bg-white border-mist'
        }`}
    >
      {link.featured && (
        <div className="absolute -top-1.5 right-3">
          <Star size={12} className="text-blue fill-blue" />
        </div>
      )}
      {Icon && (
        <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors
          ${link.featured ? 'bg-blue/10 text-blue' : 'bg-snow text-steel group-hover:text-blue group-hover:bg-blue/5'}`}>
          <Icon size={20} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <span className="block text-[15px] font-medium text-ink leading-snug truncate">
          {link.title}
        </span>
        {link.description && (
          <span className="block text-xs text-steel mt-0.5 break-words select-all">{link.description}</span>
        )}
      </div>
      <ArrowUpRight
        size={16}
        className="flex-shrink-0 text-silver group-hover:text-blue transition-colors group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
      />
    </motion.a>
  )
}

/* ─── Main page ─── */
export default function LinkInBio() {
  const [data, setData] = useState<BioData | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const fetchData = useCallback(() => {
    setStatus('loading')
    fetch('/api/v1/bio')
      .then(res => {
        if (!res.ok) throw new Error('fetch failed')
        return res.json()
      })
      .then((d: BioData) => {
        setData(d)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (status === 'loading') return <LoadingSkeleton />
  if (status === 'error' || !data) return <ErrorState onRetry={fetchData} />

  const { settings, links, socials } = data
  const enabledLinks = links
    .filter(l => l.enabled)
    .sort((a, b) => a.sort_order - b.sort_order)

  const featured = enabledLinks.filter(l => l.featured)
  const regular = enabledLinks.filter(l => !l.featured)

  // Group regular links by category
  const categories = new Map<string, BioLinkResponse[]>()
  const uncategorized: BioLinkResponse[] = []
  for (const link of regular) {
    if (link.category) {
      if (!categories.has(link.category)) categories.set(link.category, [])
      categories.get(link.category)!.push(link)
    } else {
      uncategorized.push(link)
    }
  }

  let linkIndex = featured.length

  return (
    <div className="min-h-dvh bg-snow relative">
      {/* ═══ Background pattern ═══ */}
      <div
        className="fixed inset-0 opacity-[0.30] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--color-mist) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue/[0.03] rounded-full blur-[140px] pointer-events-none" />

      {/* ═══ Content ═══ */}
      <div className="relative max-w-md mx-auto px-5 pb-12">
        {/* ─── Header ─── */}
        <header className="pt-12 pb-8 flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {settings.avatar_url ? (
              <img
                src={settings.avatar_url}
                alt={settings.heading}
                className="w-24 h-24 md:w-28 md:h-28 rounded-full object-cover object-top border-[3px] border-white shadow-lg shadow-black/5"
              />
            ) : (
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-gradient-to-br from-blue/20 to-violet/20 flex items-center justify-center border-[3px] border-white shadow-lg">
                <User size={36} className="text-steel" />
              </div>
            )}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-5 text-3xl md:text-4xl font-serif italic text-ink leading-tight"
          >
            {settings.heading}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="mt-2 font-mono text-xs text-steel tracking-wide"
          >
            {settings.subheading}
          </motion.p>

          {settings.show_portfolio_link && (
            <motion.a
              href="/"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-mist bg-white text-xs font-mono text-steel hover:text-blue hover:border-blue/30 transition-colors"
            >
              View Portfolio
              <ArrowUpRight size={12} />
            </motion.a>
          )}
        </header>

        {/* ─── Featured links ─── */}
        {featured.length > 0 && (
          <section className="mb-4">
            <div className="flex flex-col gap-3">
              {featured.map((link, i) => (
                <div key={link.id} className="relative">
                  <LinkButton link={link} index={i} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── Categorized links ─── */}
        {Array.from(categories.entries()).map(([category, categoryLinks]) => {
          const section = (
            <section key={category} className="mb-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 + linkIndex * 0.06 }}
                className="px-1 mb-2 mt-4"
              >
                <span className="font-mono text-[11px] text-steel tracking-[0.2em] uppercase">
                  {category}
                </span>
              </motion.div>
              <div className="flex flex-col gap-3">
                {categoryLinks.map(link => {
                  const el = <LinkButton key={link.id} link={link} index={linkIndex} />
                  linkIndex++
                  return el
                })}
              </div>
            </section>
          )
          return section
        })}

        {/* ─── Uncategorized links ─── */}
        {uncategorized.length > 0 && (
          <section className="mb-4">
            <div className="flex flex-col gap-3">
              {uncategorized.map(link => {
                const el = <LinkButton key={link.id} link={link} index={linkIndex} />
                linkIndex++
                return el
              })}
            </div>
          </section>
        )}

        {/* ─── Book a Call CTA ─── */}
        {settings.show_booking_link && (
          <motion.a
            href="/contact#book"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 + linkIndex * 0.06 }}
            className="group flex items-center justify-center gap-3 w-full mt-6 px-5 py-4 rounded-2xl bg-blue text-white font-mono text-sm font-semibold shadow-lg shadow-blue/20 hover:bg-blue-dim transition-colors"
          >
            <Calendar size={18} />
            Book a Call
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </motion.a>
        )}

        {/* ─── Social icons ─── */}
        {socials.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="flex items-center justify-center gap-3 mt-10"
          >
            {socials.map(social => {
              const SocialIcon = getIcon(social.icon)
              return (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-mist text-steel hover:text-blue hover:border-blue/30 hover:shadow-sm transition-all"
                >
                  <SocialIcon size={16} />
                  <span className="text-xs font-mono">{social.label}</span>
                </a>
              )
            })}
          </motion.div>
        )}

        {/* ─── Footer ─── */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="mt-12 pb-4 text-center"
        >
          <a
            href="/"
            className="font-mono text-[11px] text-silver hover:text-steel transition-colors tracking-wide"
          >
            nathanblatter.com
          </a>
        </motion.footer>
      </div>
    </div>
  )
}
