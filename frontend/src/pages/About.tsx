import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import SectionHeader from '../components/SectionHeader'
import TimelineItem from '../components/TimelineItem'
import GitHubSection from '../components/GitHubSection'
import ClaudeSection from '../components/ClaudeSection'
import Skeleton from '../components/Skeleton'
import { Quote, ExternalLink, Star } from 'lucide-react'
import { api, type AboutResponse, type InterestResponse, type CourseworkResponse, type ExperienceResponse, type TestimonialResponse, type CertificationResponse } from '../lib/api'
import { usePortfolioCtx } from '../lib/usePortfolioCtx'
import { getIcon } from '../lib/iconMap'

export default function About() {
  const [about, setAbout] = useState<AboutResponse | null>(null)
  const [interests, setInterests] = useState<InterestResponse[]>([])
  const [coursework, setCoursework] = useState<CourseworkResponse[]>([])
  const [experience, setExperience] = useState<ExperienceResponse[]>([])
  const [testimonials, setTestimonials] = useState<TestimonialResponse[]>([])
  const [certifications, setCertifications] = useState<CertificationResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const portfolioCtx = usePortfolioCtx()

  useEffect(() => {
    setLoading(true)
    setError(false)
    api.aboutPage.get().then(({ about: ab, interests: intr, coursework: cw, experience: ex, testimonials: test, certifications: certs }) => {
      setAbout(ab)
      setInterests(intr)
      setCoursework(cw)
      setExperience(ex)
      setTestimonials(test)
      setCertifications(certs ?? [])
    }).catch(() => setError(true)).finally(() => setLoading(false))
  }, [retryKey])

  const displayAbout: AboutResponse | null = about ? {
    ...about,
    bio_paragraphs: portfolioCtx?.about?.bio_paragraphs ?? about.bio_paragraphs,
    status_text: portfolioCtx?.about?.status_text ?? about.status_text,
    gpa: portfolioCtx?.about?.gpa ?? about.gpa,
    looking_for: (portfolioCtx?.about?.looking_for ?? about.looking_for) as AboutResponse['looking_for'],
    info_fields: (portfolioCtx?.about?.info_fields ?? about.info_fields) as AboutResponse['info_fields'],
    headshot_url: portfolioCtx?.about?.headshot_url ?? about.headshot_url,
    facts: (portfolioCtx?.about?.facts ?? about.facts) as AboutResponse['facts'],
  } : null

  const displayInterests = portfolioCtx
    ? interests.filter(i => (portfolioCtx.interests?.[String(i.id)]?.visibility ?? 'show') !== 'hide')
    : interests

  const displayTestimonials = portfolioCtx
    ? testimonials.filter(t => (portfolioCtx.testimonials?.[String(t.id)]?.visibility ?? 'show') !== 'hide')
    : testimonials

  const displayExperience = portfolioCtx
    ? experience.filter(e => (portfolioCtx.experience?.[String(e.id)]?.visibility ?? 'show') !== 'hide')
    : experience

  if (error) {
    return (
      <section className="py-24 min-h-[60vh] flex items-center justify-center">
        <div className="text-center text-steel">
          <p className="font-mono text-sm mb-2">Couldn't load this page.</p>
          <button
            onClick={() => setRetryKey(k => k + 1)}
            className="font-mono text-xs text-blue hover:underline underline-offset-2 mt-1"
          >
            Retry
          </button>
        </div>
      </section>
    )
  }

  return (
    <>
      {/* Bio section */}
      <section className="py-16 md:py-28">
        <div className="max-w-[900px] w-full mx-auto px-6">
          <SectionHeader code="// ABOUT" title="About Me" />

          <div className="grid grid-cols-1 md:grid-cols-5 gap-10 md:gap-16">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="md:col-span-3 space-y-6"
            >
              {loading ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-4/5" />
                  </div>
                  <div className="pt-6 grid grid-cols-2 gap-3 md:gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 md:p-4 rounded-xl border border-mist bg-snow">
                        <Skeleton className="h-4 w-4 shrink-0" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {displayAbout?.bio_paragraphs[0] && (
                <p className="text-base md:text-lg text-ink leading-relaxed">
                  {displayAbout.bio_paragraphs[0]}
                </p>
              )}
              {displayAbout?.bio_paragraphs[1] && (
                <p className="text-slate leading-relaxed">
                  {displayAbout.bio_paragraphs[1]}
                </p>
              )}
              {displayAbout?.bio_paragraphs[2] && (
                <p className="text-slate leading-relaxed">
                  {displayAbout.bio_paragraphs[2]}
                </p>
              )}

              {displayAbout?.facts && displayAbout.facts.length > 0 && (
                <div className="pt-6 grid grid-cols-2 gap-3 md:gap-4">
                  {displayAbout!.facts!.map((fact, i) => {
                    const Icon = getIcon(fact.icon)
                    return (
                      <motion.div
                        key={fact.text}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 + i * 0.1 }}
                        className="flex items-center gap-3 p-3 md:p-4 rounded-xl border border-mist bg-snow"
                      >
                        <Icon size={16} className="text-blue shrink-0" />
                        <span className="text-sm text-ink">{fact.text}</span>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="md:col-span-2"
            >
              <div className="aspect-[3/4] rounded-2xl border border-mist bg-cloud overflow-hidden relative">
                <picture>
                  {!about?.headshot_url && (
                    <source
                      srcSet="/headshot-400w.webp 400w, /headshot-600w.webp 600w, /headshot.webp 800w"
                      sizes="(max-width: 640px) 400px, (max-width: 1024px) 600px, 800px"
                      type="image/webp"
                    />
                  )}
                  <img
                    src={displayAbout?.headshot_url ?? '/headshot.webp'}
                    alt="Nathan Blatter"
                    width={800}
                    height={1200}
                    loading="eager"
                    decoding="async"
                    className="w-full h-full object-cover object-top"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      const retries = Number(target.dataset.retries || '0')
                      if (retries < 2) {
                        target.dataset.retries = String(retries + 1)
                        setTimeout(() => { target.src = target.src.split('?')[0] + '?r=' + Date.now() }, 1000 * (retries + 1))
                        return
                      }
                      target.style.display = 'none'
                      target.parentElement!.innerHTML = `
                        <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue/5 to-violet/5">
                          <div class="text-center">
                            <div class="w-20 h-20 rounded-full bg-white border-2 border-mist mx-auto mb-4 flex items-center justify-center shadow-sm">
                              <span style="font-family: var(--font-serif); font-size: 2rem; font-style: italic; color: var(--color-blue);">N</span>
                            </div>
                            <p style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--color-steel);">Photo coming soon</p>
                          </div>
                        </div>`
                    }}
                  />
                </picture>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* What I'm Looking For */}
      {displayAbout?.looking_for && displayAbout.looking_for.length > 0 && (
        <section className="py-16 md:py-28 bg-snow">
          <div className="max-w-[900px] w-full mx-auto px-6">
            <SectionHeader
              code="// SEEKING"
              title="What I'm Looking For"
              subtitle="Roles and opportunities I'm excited about."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {displayAbout.looking_for.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="p-5 rounded-xl border border-mist bg-white"
                >
                  <h4 className="font-sans font-semibold text-ink mb-2">{item.role}</h4>
                  {item.location && (
                    <p className="font-mono text-[11px] text-steel mb-1">{item.location}</p>
                  )}
                  {item.timeline && (
                    <p className="font-mono text-[11px] text-blue mb-2">{item.timeline}</p>
                  )}
                  {item.detail && (
                    <p className="text-sm text-steel leading-relaxed">{item.detail}</p>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Focus Areas */}
      <section className="py-16 md:py-28 bg-snow">
        <div className="max-w-[900px] w-full mx-auto px-6">
          <SectionHeader
            code="// FOCUS"
            title="Interests"
            subtitle="Areas I'm most passionate about."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="p-5 md:p-6 rounded-xl border border-mist bg-white space-y-3">
                    <Skeleton className="h-5 w-5" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-4/5" />
                  </div>
                ))
              : null}
            {displayInterests.map((item, i) => {
              const Icon = getIcon(item.icon)
              const isHighlighted = (portfolioCtx?.interests?.[String(item.id)]?.visibility ?? 'show') === 'highlight'
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className={`group p-5 md:p-6 rounded-xl border bg-white hover:border-blue/30 hover:shadow-lg hover:shadow-blue/5 transition-all ${isHighlighted ? 'border-blue/40 ring-2 ring-blue/20' : 'border-mist'}`}
                >
                  <Icon size={20} className="text-blue mb-4 group-hover:scale-110 transition-transform" />
                  <h4 className="font-sans font-semibold text-ink mb-1">{item.label}</h4>
                  <p className="text-sm text-steel leading-relaxed">{item.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Coursework */}
      <section className="py-16 md:py-28">
        <div className="max-w-[700px] w-full mx-auto px-6">
          <SectionHeader
            code="// COURSEWORK"
            title="Studies"
            subtitle="Key courses shaping my technical foundation at BYU."
          />
          <div className="flex flex-wrap justify-center gap-3">
            {loading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-28 rounded-xl" />
                ))
              : null}
            {coursework.map((course, i) => (
              <motion.span
                key={course.id}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="font-mono text-xs md:text-sm px-4 md:px-5 py-2.5 md:py-3 rounded-xl border border-mist text-ink bg-snow hover:border-blue/30 hover:text-blue transition-colors cursor-default"
              >
                {course.name}
              </motion.span>
            ))}
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section className="py-16 md:py-28">
        <div className="max-w-[900px] w-full mx-auto px-6">
          <SectionHeader
            code="// CERTS"
            title="Certifications"
            subtitle="Verified credentials and professional certifications."
          />
          {loading ? (
            <div className="flex flex-wrap gap-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-5 p-5 rounded-xl border border-mist bg-white max-w-sm w-[320px]">
                  <Skeleton className="w-16 h-16 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : (() => {
            const certHref = (c: CertificationResponse) => (c.verify_slug ? `/go/${c.verify_slug}` : c.verify_url)
            const featured = certifications.filter(c => c.featured)
            const rest = certifications.filter(c => !c.featured)
            // Preserve first-seen order of categories; uncategorized fall under "Other".
            const groups: { category: string; items: CertificationResponse[] }[] = []
            for (const c of rest) {
              const cat = (c.category || '').trim() || 'Other'
              let g = groups.find(x => x.category === cat)
              if (!g) { g = { category: cat, items: [] }; groups.push(g) }
              g.items.push(c)
            }

            return (
              <div className="space-y-12">
                {/* Featured — large detailed cards */}
                {featured.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {featured.map((cert, i) => {
                      const href = certHref(cert)
                      return (
                        <motion.a
                          key={cert.id}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          initial={{ opacity: 0, y: 20 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: i * 0.08 }}
                          className="group relative flex items-center gap-5 p-6 rounded-xl border border-blue/20 bg-gradient-to-br from-blue-wash to-white hover:border-blue/40 hover:shadow-lg hover:shadow-blue/5 transition-all"
                        >
                          <span className="absolute top-3 right-3 inline-flex items-center gap-1 font-mono text-[10px] text-violet">
                            <Star size={10} fill="currentColor" /> Featured
                          </span>
                          {cert.image_url && (
                            <img
                              src={cert.image_url}
                              alt={cert.name}
                              loading="lazy"
                              decoding="async"
                              className="w-20 h-20 object-contain shrink-0 bg-[#ffffff] rounded-lg p-2 border border-mist"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                            />
                          )}
                          <div className="min-w-0">
                            <p className="font-sans font-semibold text-ink text-lg leading-snug mb-1">{cert.name}</p>
                            <p className="font-mono text-[11px] text-steel mb-3">{cert.issuer}</p>
                            {href && (
                              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-blue group-hover:underline">
                                Verify <ExternalLink size={10} />
                              </span>
                            )}
                          </div>
                        </motion.a>
                      )
                    })}
                  </div>
                )}

                {/* Grouped by category — compact strips */}
                {groups.map(group => (
                  <div key={group.category}>
                    <div className="flex items-center gap-3 mb-4">
                      <h3 className="font-mono text-[11px] text-steel tracking-wider uppercase shrink-0">{group.category}</h3>
                      <div className="flex-1 h-px bg-mist" />
                      <span className="font-mono text-[11px] text-silver shrink-0">{group.items.length}</span>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {group.items.map((cert, i) => {
                        const href = certHref(cert)
                        return (
                          <motion.a
                            key={cert.id}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            initial={{ opacity: 0, y: 12 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: Math.min(i * 0.05, 0.3) }}
                            title={href ? `Verify ${cert.name}` : cert.name}
                            className="group flex items-center gap-3 px-3.5 py-2.5 rounded-lg border border-mist bg-white hover:border-blue/30 hover:shadow-sm transition-all"
                          >
                            {cert.image_url && (
                              <img
                                src={cert.image_url}
                                alt={cert.name}
                                loading="lazy"
                                decoding="async"
                                className="w-9 h-9 object-contain shrink-0 bg-[#ffffff] rounded p-0.5"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                              />
                            )}
                            <div className="min-w-0">
                              <p className="font-sans text-sm font-medium text-ink leading-tight truncate">{cert.name}</p>
                              <p className="font-mono text-[10px] text-steel truncate">{cert.issuer}</p>
                            </div>
                            {href && (
                              <ExternalLink size={11} className="text-silver group-hover:text-blue shrink-0 transition-colors" />
                            )}
                          </motion.a>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      </section>

      {/* GitHub */}
      <section className="py-16 md:py-28 bg-snow">
        <div className="max-w-[1100px] w-full mx-auto px-6">
          <SectionHeader
            code="// GITHUB"
            title="GitHub"
            subtitle="Contributions and recent repositories."
          />
          <GitHubSection />
        </div>
      </section>

      {/* Claude Code */}
      <section className="py-16 md:py-28">
        <div className="max-w-[1100px] w-full mx-auto px-6">
          <SectionHeader
            code="// CLAUDE"
            title="Claude Code"
            subtitle="AI-assisted development activity and cost."
          />
          <ClaudeSection />
        </div>
      </section>

      {/* Testimonials */}
      {displayTestimonials.length > 0 && (
        <section className="py-16 md:py-28 bg-snow">
          <div className="max-w-[900px] w-full mx-auto px-6">
            <SectionHeader
              code="// TESTIMONIALS"
              title="Kind Words"
              subtitle="From professors, managers, and teammates."
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {displayTestimonials.map((t, i) => {
                const isHighlighted = (portfolioCtx?.testimonials?.[String(t.id)]?.visibility ?? 'show') === 'highlight'
                return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className={`p-6 rounded-xl border bg-white ${isHighlighted ? 'border-blue/40 ring-2 ring-blue/20' : 'border-mist'}`}
                >
                  <Quote size={20} className="text-blue/30 mb-3" />
                  <p className="text-ink/80 text-sm leading-relaxed mb-5 italic">
                    "{t.quote}"
                  </p>
                  <div className="flex items-center gap-3">
                    {t.avatar_url ? (
                      <img src={t.avatar_url} alt={t.name} loading="lazy" className="w-9 h-9 rounded-full object-cover border border-mist" />
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
                </motion.div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Timeline */}
      <section className="py-16 md:py-28">
        <div className="max-w-[700px] w-full mx-auto px-6">
          <SectionHeader
            code="// TIMELINE"
            title="Experience"
            subtitle="Where I've been and what I've done."
          />
          <div>
            {displayExperience.map((item, i) => {
              const expCtx = portfolioCtx?.experience?.[String(item.id)]
              return (
                <TimelineItem
                  key={item.id}
                  {...item}
                  title={expCtx?.title ?? item.title}
                  subtitle={expCtx?.subtitle ?? item.subtitle}
                  description={expCtx?.description ?? item.description}
                  note={expCtx?.note}
                  highlighted={(expCtx?.visibility ?? 'show') === 'highlight'}
                  index={i}
                />
              )
            })}
          </div>
        </div>
      </section>
    </>
  )
}
