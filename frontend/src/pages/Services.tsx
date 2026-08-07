import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { track } from '../lib/track'
import { ArrowRight, Check, Sparkles } from 'lucide-react'
import SectionHeader from '../components/SectionHeader'
import Skeleton from '../components/Skeleton'
import TestimonialStrip from '../components/TestimonialStrip'
import { usePortfolioCtx } from '../lib/usePortfolioCtx'
import { getIcon } from '../lib/iconMap'
import {
  api,
  type ServicesMetaResponse,
  type ServiceOfferingResponse,
  type ServiceProcessStepResponse,
  type EngagementTierResponse,
  type TestimonialResponse,
} from '../lib/api'

export default function Services() {
  const [meta, setMeta] = useState<ServicesMetaResponse | null>(null)
  const [offerings, setOfferings] = useState<ServiceOfferingResponse[]>([])
  const [process, setProcess] = useState<ServiceProcessStepResponse[]>([])
  const [tiers, setTiers] = useState<EngagementTierResponse[]>([])
  const [testimonials, setTestimonials] = useState<TestimonialResponse[]>([])
  const [loading, setLoading] = useState(true)
  const portfolioCtx = usePortfolioCtx()

  const visibleTestimonials = portfolioCtx
    ? testimonials.filter(t => (portfolioCtx.testimonials?.[String(t.id)]?.visibility ?? 'show') !== 'hide')
    : testimonials

  useEffect(() => {
    api.services.page()
      .then(({ meta: m, offerings: o, process: p, tiers: t, testimonials: te }) => {
        setMeta(m); setOfferings(o); setProcess(p); setTiers(t); setTestimonials(te)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="absolute inset-0 opacity-[0.35]" style={{
          backgroundImage: `radial-gradient(circle, var(--color-mist) 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }} />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue/[0.04] rounded-full blur-[120px]" />

        <div className="relative max-w-[820px] w-full mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="h-px w-8 md:w-12 bg-blue" />
            <span className="font-mono text-[10px] md:text-xs text-blue tracking-[0.3em] uppercase">
              Consulting & Freelance
            </span>
            <div className="h-px w-8 md:w-12 bg-blue" />
          </div>

          {loading ? (
            <div className="flex flex-col items-center gap-4">
              <Skeleton className="h-16 w-72 md:w-[420px]" />
              <Skeleton className="h-5 w-80 md:w-[520px]" />
              <Skeleton className="h-4 w-full max-w-[560px]" />
            </div>
          ) : (
            <>
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-serif italic text-ink leading-[0.95] mb-6">
                {meta?.heading ?? 'Work With Me'}
              </h1>
              <p className="text-base md:text-xl text-steel max-w-[560px] mx-auto leading-relaxed mb-6">
                {meta?.subheading}
              </p>
              {meta?.intro && (
                <p className="text-sm md:text-base text-slate max-w-[600px] mx-auto leading-relaxed mb-10">
                  {meta.intro}
                </p>
              )}
              <Link
                to="/contact"
                onClick={() => track('services-cta', { placement: 'hero' })}
                className="group inline-flex items-center justify-center gap-3 px-7 py-3.5 bg-blue text-white font-mono text-sm font-semibold rounded-xl hover:bg-blue-dim transition-colors shadow-lg shadow-blue/20"
              >
                {meta?.cta_button_label || 'Book a Call'}
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </>
          )}
        </div>
      </section>

      {/* ═══ OFFERINGS ═══ */}
      <section className="py-16 md:py-24 bg-snow">
        <div className="max-w-[1100px] w-full mx-auto px-6">
          <SectionHeader
            code="// 01"
            title="What I Do"
            subtitle="Where I can help — from a single feature to an end-to-end build."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-6 rounded-2xl border border-mist bg-white space-y-3">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-5/6" />
                  </div>
                ))
              : offerings.map((o, i) => {
                  const Icon = getIcon(o.icon)
                  return (
                    <motion.div
                      key={o.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.08 }}
                      className="group p-6 rounded-2xl border border-mist bg-white hover:border-blue/30 hover:shadow-lg hover:shadow-blue/5 transition-all"
                    >
                      <div className="w-11 h-11 rounded-xl bg-blue-wash flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                        <Icon size={20} className="text-blue" />
                      </div>
                      <h3 className="font-sans font-semibold text-ink text-lg mb-2">{o.title}</h3>
                      <p className="text-steel text-sm leading-relaxed">{o.description}</p>
                    </motion.div>
                  )
                })
            }
          </div>
        </div>
      </section>

      {/* ═══ PROCESS ═══ */}
      {(loading || process.length > 0) && (
        <section className="py-16 md:py-24">
          <div className="max-w-[900px] w-full mx-auto px-6">
            <SectionHeader
              code="// 02"
              title="How We'll Work"
              subtitle="A simple, transparent process from first call to handoff."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="p-5 rounded-2xl border border-mist bg-snow space-y-3">
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  ))
                : process.map((step, i) => (
                    <motion.div
                      key={step.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.08 }}
                      className="p-5 rounded-2xl border border-mist bg-snow"
                    >
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue text-white font-mono text-sm font-bold mb-3">
                        {i + 1}
                      </span>
                      <h3 className="font-sans font-semibold text-ink text-sm mb-1.5">{step.title}</h3>
                      <p className="text-steel text-xs leading-relaxed">{step.description}</p>
                    </motion.div>
                  ))
              }
            </div>
          </div>
        </section>
      )}

      {/* ═══ ENGAGEMENT TIERS ═══ */}
      {(loading || tiers.length > 0) && (
        <section className="py-16 md:py-24 bg-snow">
          <div className="max-w-[1100px] w-full mx-auto px-6">
            <SectionHeader
              code="// 03"
              title="Engagements"
              subtitle="Flexible ways to work together. Every quote is scoped to your project."
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {loading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="p-6 rounded-2xl border border-mist bg-white space-y-4">
                      <Skeleton className="h-5 w-28" />
                      <Skeleton className="h-8 w-32" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-5/6" />
                    </div>
                  ))
                : tiers.map((tier, i) => (
                    <motion.div
                      key={tier.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.08 }}
                      className={`relative p-6 rounded-2xl border bg-white flex flex-col ${
                        tier.highlighted ? 'border-blue/40 ring-2 ring-blue/20 shadow-xl shadow-blue/10 md:-translate-y-2' : 'border-mist'
                      }`}
                    >
                      {tier.highlighted && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue text-white font-mono text-[10px] tracking-wider uppercase">
                          <Sparkles size={11} /> Most Popular
                        </span>
                      )}
                      <h3 className="font-sans font-semibold text-ink text-lg mb-1">{tier.name}</h3>
                      <div className="font-serif italic text-3xl text-blue mb-3">{tier.price_label}</div>
                      {tier.description && (
                        <p className="text-steel text-sm leading-relaxed mb-5">{tier.description}</p>
                      )}
                      <ul className="space-y-2.5 mb-6 flex-1">
                        {tier.features.map((f, fi) => (
                          <li key={fi} className="flex items-start gap-2.5 text-sm text-ink/80">
                            <Check size={15} className="text-teal mt-0.5 shrink-0" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                      <Link
                        to="/contact"
                        onClick={() => track('services-cta', { placement: 'tier', tier: tier.name })}
                        className={`group inline-flex items-center justify-center gap-2 px-5 py-3 font-mono text-sm font-semibold rounded-xl transition-colors ${
                          tier.highlighted
                            ? 'bg-blue text-white hover:bg-blue-dim shadow-lg shadow-blue/20'
                            : 'border border-mist text-ink hover:border-blue hover:text-blue'
                        }`}
                      >
                        {tier.cta_label}
                        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </motion.div>
                  ))
              }
            </div>
          </div>
        </section>
      )}

      {/* ═══ TESTIMONIALS ═══ */}
      {testimonials.length > 0 && (
        <section className="py-16 md:py-24">
          <div className="max-w-[1100px] w-full mx-auto px-6 mb-8">
            <SectionHeader
              code="// 04"
              title="Kind Words"
              subtitle="From clients, professors, managers, and teammates."
            />
          </div>
          <div className="max-w-[1280px] mx-auto">
            <TestimonialStrip testimonials={visibleTestimonials} />
          </div>
        </section>
      )}

      {/* ═══ CTA BANNER ═══ */}
      <section className="py-16 md:py-28 relative overflow-hidden bg-snow">
        <div className="absolute inset-0 bg-gradient-to-r from-blue/[0.03] via-transparent to-violet/[0.03]" />
        <div className="relative max-w-[700px] w-full mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-serif text-4xl md:text-6xl italic text-ink mb-6">
              {meta?.cta_heading || "Let's build something"}
            </h2>
            <p className="text-steel text-base md:text-lg mb-10 max-w-md mx-auto leading-relaxed">
              {meta?.cta_text || 'Book a free intro call and tell me about your project.'}
            </p>
            <Link
              to="/contact"
              onClick={() => track('services-cta', { placement: 'banner' })}
              className="group inline-flex items-center gap-3 px-8 py-4 bg-blue text-white font-mono text-sm font-semibold rounded-xl hover:bg-blue-dim transition-colors shadow-lg shadow-blue/20"
            >
              {meta?.cta_button_label || 'Book a Call'}
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </section>
    </>
  )
}
