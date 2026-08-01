import { motion, useReducedMotion } from 'motion/react'
import { Quote } from 'lucide-react'
import type { TestimonialResponse } from '../lib/api'

/**
 * A continuously scrolling marquee of testimonials, reused on Home and Services.
 * For reduced-motion users the marquee is disabled and the track becomes a
 * plain horizontally scrollable list, so every card stays reachable.
 */
export default function TestimonialStrip({ testimonials }: { testimonials: TestimonialResponse[] }) {
  const reduceMotion = useReducedMotion()
  if (!testimonials.length) return null

  // Duplicate the list so the -50% translate loops seamlessly.
  const loop = reduceMotion ? testimonials : [...testimonials, ...testimonials]
  // Slow the scroll proportionally to the number of cards.
  const duration = Math.max(20, testimonials.length * 8)

  return (
    <div
      className={`relative ${reduceMotion ? 'overflow-x-auto' : 'overflow-x-hidden'}`}
      style={{
        maskImage: 'linear-gradient(to right, transparent, black 6%, black 94%, transparent)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, black 6%, black 94%, transparent)',
      }}
    >
      <motion.ul
        className="flex gap-5 w-max py-2"
        animate={reduceMotion ? undefined : { x: ['0%', '-50%'] }}
        transition={reduceMotion ? undefined : { duration, ease: 'linear', repeat: Infinity }}
      >
        {loop.map((t, i) => (
          <li
            key={`${t.id}-${i}`}
            aria-hidden={i >= testimonials.length}
            className="w-[300px] sm:w-[360px] shrink-0 p-6 rounded-2xl border border-mist bg-white"
          >
            <Quote size={18} className="text-blue/30 mb-3" />
            <p className="text-ink/80 text-sm leading-relaxed mb-5 italic line-clamp-3">
              "{t.quote}"
            </p>
            <div className="flex items-center gap-3">
              {t.avatar_url ? (
                <img
                  src={t.avatar_url}
                  alt={t.name}
                  loading="lazy"
                  decoding="async"
                  className="w-9 h-9 rounded-full object-cover border border-mist"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-blue/10 flex items-center justify-center">
                  <span className="font-mono text-xs text-blue font-bold">{t.name.charAt(0)}</span>
                </div>
              )}
              <div>
                <span className="text-sm font-medium text-ink block leading-tight">{t.name}</span>
                <span className="font-mono text-[11px] text-steel">{t.role}</span>
              </div>
            </div>
          </li>
        ))}
      </motion.ul>
    </div>
  )
}
