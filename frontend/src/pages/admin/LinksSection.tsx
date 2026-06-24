import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { Plus, Trash2, Save, Copy, Settings } from 'lucide-react'
import {
  api,
  type ProjectResponse,
  type SkillResponse,
  type ExperienceResponse,
  type AboutResponse,
  type InterestResponse,
  type TestimonialResponse,
  type TrackedLinkResponse,
} from '../../lib/api'
import { AdminInput, AdminTextarea, VisibilityToggle, SectionCard, type AdminCallbacks } from './AdminShared'

interface LinksSectionProps extends AdminCallbacks {
  projects: ProjectResponse[]
  skills: SkillResponse[]
  experience: ExperienceResponse[]
  interests: InterestResponse[]
  testimonials: TestimonialResponse[]
  about: AboutResponse | null
}

export default function LinksSection({ showToast, showError, projects, skills, experience, interests, testimonials, about }: LinksSectionProps) {
  const [trackedLinks, setTrackedLinks] = useState<TrackedLinkResponse[]>([])
  const [expandedCtx, setExpandedCtx] = useState<number | null>(null)
  const [ctxTab, setCtxTab] = useState('hero')

  useEffect(() => {
    api.links.list()
      .then(l => setTrackedLinks(l))
      .catch(err => showError((err as Error).message))
  }, [showError])

  const addLink = async () => {
    try {
      const created = await api.links.create({ slug: `link-${Date.now()}`, destination_url: 'https://', label: 'New Link' })
      setTrackedLinks(prev => [created, ...prev])
      showToast('Link created')
    } catch (err) { showError((err as Error).message) }
  }

  const saveLink = async (link: TrackedLinkResponse) => {
    try {
      await api.links.update(link.id, {
        slug: link.slug,
        destination_url: link.destination_url,
        label: link.label,
        portfolio_ctx: link.portfolio_ctx,
      })
      showToast('Link saved')
    } catch (err) { showError((err as Error).message) }
  }

  const removeLink = async (id: number) => {
    try {
      await api.links.delete(id)
      setTrackedLinks(prev => prev.filter(l => l.id !== id))
      showToast('Link deleted')
    } catch (err) { showError((err as Error).message) }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-sans font-semibold text-ink mb-1">Tracked Links</h2>
          <p className="text-steel text-sm">{trackedLinks.length} link{trackedLinks.length !== 1 ? 's' : ''} · Track clicks via Umami</p>
        </div>
        <button onClick={addLink} className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors shadow-sm">
          <Plus size={14} /> New Link
        </button>
      </div>

      <SectionCard className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
        <div className="min-w-[640px]">
        <div className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-0 text-[11px] font-mono text-steel tracking-wider uppercase px-6 py-3 border-b border-mist bg-cloud/50">
          <span>Label / Slug</span>
          <span>Destination</span>
          <span className="w-16 text-center">Clicks</span>
          <span className="w-8"></span>
          <span className="w-8"></span>
          <span className="w-8"></span>
        </div>
        {trackedLinks.length === 0 && (
          <p className="text-center text-steel text-sm py-8 font-mono">No links yet.</p>
        )}
        {trackedLinks.map(link => (
          <div key={link.id}>
            <div className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-0 items-center px-6 py-3.5 border-b border-mist last:border-b-0 hover:bg-cloud/30 transition-colors">
              <div>
                <input
                  value={link.label}
                  onChange={e => setTrackedLinks(prev => prev.map(l => l.id === link.id ? { ...l, label: e.target.value } : l))}
                  className="text-sm text-ink font-medium bg-transparent focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue/10 rounded px-2 py-1 -ml-2 transition-all w-full"
                  placeholder="Label"
                />
                <div className="flex items-center gap-1 ml-0">
                  <span className="font-mono text-[10px] text-silver">/go/</span>
                  <input
                    value={link.slug}
                    onChange={e => setTrackedLinks(prev => prev.map(l => l.id === link.id ? { ...l, slug: e.target.value } : l))}
                    className="font-mono text-[11px] text-steel bg-transparent focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue/10 rounded px-1 py-0.5 transition-all"
                    placeholder="slug"
                  />
                  <button
                    onClick={() => { navigator.clipboard.writeText(`https://nathanblatter.com/go/${link.slug}`); showToast('Copied') }}
                    className="p-1 text-silver hover:text-blue transition-colors"
                  >
                    <Copy size={10} />
                  </button>
                </div>
              </div>
              <input
                value={link.destination_url}
                onChange={e => setTrackedLinks(prev => prev.map(l => l.id === link.id ? { ...l, destination_url: e.target.value } : l))}
                className="font-mono text-xs text-steel bg-transparent focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue/10 rounded px-2 py-1 transition-all truncate"
                placeholder="https://..."
              />
              <span className="w-16 text-center font-mono text-sm font-semibold text-ink">{link.clicks}</span>
              <button
                onClick={() => setExpandedCtx(expandedCtx === link.id ? null : link.id)}
                className={`p-1.5 transition-colors ${link.portfolio_ctx ? 'text-blue' : 'text-steel hover:text-blue'}`}
                title="Customize portfolio view"
              >
                <Settings size={13} />
              </button>
              <button onClick={() => saveLink(link)} className="p-1.5 text-steel hover:text-blue transition-colors">
                <Save size={13} />
              </button>
              <button onClick={() => removeLink(link.id)} className="p-1.5 text-steel hover:text-ember transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
            {expandedCtx === link.id && (() => {
              const patchCtx = (patch: Partial<NonNullable<TrackedLinkResponse['portfolio_ctx']>>) => {
                setTrackedLinks(prev => prev.map(l => l.id !== link.id ? l : {
                  ...l,
                  portfolio_ctx: { projects: {}, skills: {}, experience: {}, interests: {}, testimonials: {}, ...(l.portfolio_ctx ?? {}), ...patch },
                }))
              }
              const patchAbout = (patch: Record<string, unknown>) => {
                setTrackedLinks(prev => prev.map(l => l.id !== link.id ? l : {
                  ...l,
                  portfolio_ctx: {
                    projects: {}, skills: {}, experience: {}, interests: {}, testimonials: {},
                    ...(l.portfolio_ctx ?? {}),
                    about: { ...(l.portfolio_ctx?.about ?? {}), ...patch },
                  },
                }))
              }
              const tabs = ['hero', 'projects', 'skills', 'journey', 'about', 'interests', 'testimonials']
              return (
                <div className="border-b border-mist bg-cloud/20">
                  {/* Tab bar */}
                  <div className="flex gap-0.5 px-6 pt-4 pb-0 border-b border-mist">
                    {tabs.map(tab => (
                      <button
                        key={tab}
                        onClick={() => setCtxTab(tab)}
                        className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider rounded-t transition-colors ${ctxTab === tab ? 'bg-white border border-b-white border-mist text-blue -mb-px' : 'text-steel hover:text-ink'}`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  <div className="px-6 py-5 space-y-4">
                    {/* ── Hero ── */}
                    {ctxTab === 'hero' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <AdminInput label="Company Name" value={link.portfolio_ctx?.company ?? ''} placeholder="Stripe"
                          onChange={v => patchCtx({ company: v || undefined })} />
                        <AdminInput label="Hero Tagline" value={link.portfolio_ctx?.tagline ?? ''} placeholder="Custom subtitle for this company…"
                          onChange={v => patchCtx({ tagline: v || undefined })} />
                      </div>
                    )}

                    {/* ── Projects ── */}
                    {ctxTab === 'projects' && (
                      <div className="space-y-1">
                        {projects.map(p => (
                          <div key={p.project_id} className="flex items-center justify-between py-2 border-b border-mist/50 last:border-0">
                            <div>
                              <span className="text-sm text-ink">{p.title}</span>
                              <span className="ml-2 font-mono text-[10px] text-silver">{p.year}</span>
                            </div>
                            <VisibilityToggle
                              value={link.portfolio_ctx?.projects?.[p.project_id]?.visibility ?? 'show'}
                              onChange={v => patchCtx({ projects: { ...(link.portfolio_ctx?.projects ?? {}), [p.project_id]: { visibility: v as 'show' | 'highlight' | 'hide' } } })}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ── Skills ── */}
                    {ctxTab === 'skills' && (
                      <div className="space-y-1">
                        {skills.map(s => (
                          <div key={s.id} className="flex items-center justify-between py-2 border-b border-mist/50 last:border-0">
                            <div>
                              <span className="text-sm text-ink">{s.name}</span>
                              <span className="ml-2 font-mono text-[10px] text-silver">{s.category}</span>
                            </div>
                            <VisibilityToggle
                              value={link.portfolio_ctx?.skills?.[String(s.id)]?.visibility ?? 'show'}
                              onChange={v => patchCtx({ skills: { ...(link.portfolio_ctx?.skills ?? {}), [String(s.id)]: { visibility: v as 'show' | 'highlight' | 'hide' } } })}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ── Journey ── */}
                    {ctxTab === 'journey' && (
                      <div className="space-y-3">
                        {experience.map(item => {
                          const expCtx = link.portfolio_ctx?.experience?.[String(item.id)]
                          return (
                            <div key={item.id} className="border border-mist rounded-xl p-4 bg-white space-y-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="text-sm font-medium text-ink">{item.title}</span>
                                  <span className="ml-2 font-mono text-[10px] text-steel">{item.year}</span>
                                </div>
                                <VisibilityToggle
                                  value={expCtx?.visibility ?? 'show'}
                                  onChange={v => patchCtx({ experience: { ...(link.portfolio_ctx?.experience ?? {}), [String(item.id)]: { ...(expCtx ?? {}), visibility: v as 'show' | 'highlight' | 'hide' } } })}
                                />
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <AdminInput label="Title override" value={expCtx?.title ?? ''} placeholder={item.title}
                                  onChange={v => patchCtx({ experience: { ...(link.portfolio_ctx?.experience ?? {}), [String(item.id)]: { ...(expCtx ?? { visibility: 'show' as const }), title: v || undefined } } })} />
                                <AdminInput label="Subtitle override" value={expCtx?.subtitle ?? ''} placeholder={item.subtitle}
                                  onChange={v => patchCtx({ experience: { ...(link.portfolio_ctx?.experience ?? {}), [String(item.id)]: { ...(expCtx ?? { visibility: 'show' as const }), subtitle: v || undefined } } })} />
                              </div>
                              <AdminTextarea label="Description override" value={expCtx?.description ?? ''} rows={2}
                                onChange={v => patchCtx({ experience: { ...(link.portfolio_ctx?.experience ?? {}), [String(item.id)]: { ...(expCtx ?? { visibility: 'show' as const }), description: v || undefined } } })} />
                              <AdminTextarea label="Additional note (shown below description)" value={expCtx?.note ?? ''} rows={2}
                                onChange={v => patchCtx({ experience: { ...(link.portfolio_ctx?.experience ?? {}), [String(item.id)]: { ...(expCtx ?? { visibility: 'show' as const }), note: v || undefined } } })} />
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* ── About ── */}
                    {ctxTab === 'about' && (
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <label className="block font-mono text-[11px] text-steel tracking-wider uppercase">Bio Paragraphs</label>
                          {[0, 1, 2].map(i => (
                            <AdminTextarea key={i} label={`Paragraph ${i + 1}`} rows={3}
                              value={link.portfolio_ctx?.about?.bio_paragraphs?.[i] ?? ''}
                              onChange={v => {
                                const cur = link.portfolio_ctx?.about?.bio_paragraphs ?? ['', '', '']
                                const next = [...cur] as string[]
                                while (next.length < 3) next.push('')
                                next[i] = v
                                patchAbout({ bio_paragraphs: next.every(s => !s) ? undefined : next })
                              }}
                            />
                          ))}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <AdminInput label="Status Text" value={link.portfolio_ctx?.about?.status_text ?? ''} placeholder="Open to opportunities"
                            onChange={v => patchAbout({ status_text: v || undefined })} />
                          <AdminInput label="GPA Override" value={link.portfolio_ctx?.about?.gpa ?? ''} placeholder="3.95"
                            onChange={v => patchAbout({ gpa: v || undefined })} />
                        </div>
                        <AdminInput label="Headshot URL override" value={link.portfolio_ctx?.about?.headshot_url ?? ''} placeholder="https://…"
                          onChange={v => patchAbout({ headshot_url: v || undefined })} />

                        {/* Looking For */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="font-mono text-[11px] text-steel tracking-wider uppercase">What I'm Looking For</label>
                            {!link.portfolio_ctx?.about?.looking_for ? (
                              <button onClick={() => patchAbout({ looking_for: (about?.looking_for ?? []).map(x => ({ ...x })) })}
                                className="font-mono text-[10px] text-blue hover:underline">Copy from default</button>
                            ) : (
                              <button onClick={() => patchAbout({ looking_for: undefined })}
                                className="font-mono text-[10px] text-steel hover:text-ember">Use default</button>
                            )}
                          </div>
                          {link.portfolio_ctx?.about?.looking_for ? (
                            <div className="space-y-2">
                              {link.portfolio_ctx.about.looking_for.map((item, i) => (
                                <div key={i} className="border border-mist rounded-lg p-3 bg-white space-y-2">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <AdminInput label="Role" value={item.role ?? ''} onChange={v => {
                                      const arr = [...link.portfolio_ctx!.about!.looking_for!]
                                      arr[i] = { ...arr[i], role: v }
                                      patchAbout({ looking_for: arr })
                                    }} />
                                    <AdminInput label="Location" value={item.location ?? ''} onChange={v => {
                                      const arr = [...link.portfolio_ctx!.about!.looking_for!]
                                      arr[i] = { ...arr[i], location: v }
                                      patchAbout({ looking_for: arr })
                                    }} />
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <AdminInput label="Timeline" value={item.timeline ?? ''} onChange={v => {
                                      const arr = [...link.portfolio_ctx!.about!.looking_for!]
                                      arr[i] = { ...arr[i], timeline: v }
                                      patchAbout({ looking_for: arr })
                                    }} />
                                    <div className="flex items-end gap-2">
                                      <div className="flex-1">
                                        <AdminInput label="Detail" value={item.detail ?? ''} onChange={v => {
                                          const arr = [...link.portfolio_ctx!.about!.looking_for!]
                                          arr[i] = { ...arr[i], detail: v }
                                          patchAbout({ looking_for: arr })
                                        }} />
                                      </div>
                                      <button onClick={() => patchAbout({ looking_for: link.portfolio_ctx!.about!.looking_for!.filter((_, j) => j !== i) })}
                                        className="pb-2 text-steel hover:text-ember transition-colors"><Trash2 size={13} /></button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              <button onClick={() => patchAbout({ looking_for: [...(link.portfolio_ctx?.about?.looking_for ?? []), { role: '', location: '', timeline: '', detail: '' }] })}
                                className="font-mono text-[11px] text-steel hover:text-blue transition-colors">+ Add item</button>
                            </div>
                          ) : (
                            <p className="font-mono text-[11px] text-silver">Using default values</p>
                          )}
                        </div>

                        {/* Info Fields */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="font-mono text-[11px] text-steel tracking-wider uppercase">Info Fields</label>
                            {!link.portfolio_ctx?.about?.info_fields ? (
                              <button onClick={() => patchAbout({ info_fields: (about?.info_fields ?? []).map(x => ({ ...x })) })}
                                className="font-mono text-[10px] text-blue hover:underline">Copy from default</button>
                            ) : (
                              <button onClick={() => patchAbout({ info_fields: undefined })}
                                className="font-mono text-[10px] text-steel hover:text-ember">Use default</button>
                            )}
                          </div>
                          {link.portfolio_ctx?.about?.info_fields ? (
                            <div className="space-y-2">
                              {link.portfolio_ctx.about.info_fields.map((field, i) => (
                                <div key={i} className="flex items-end gap-2">
                                  <div className="flex-1"><AdminInput label="Label" value={field.label ?? ''} onChange={v => {
                                    const arr = [...link.portfolio_ctx!.about!.info_fields!]
                                    arr[i] = { ...arr[i], label: v }
                                    patchAbout({ info_fields: arr })
                                  }} /></div>
                                  <div className="flex-1"><AdminInput label="Value" value={field.value ?? ''} onChange={v => {
                                    const arr = [...link.portfolio_ctx!.about!.info_fields!]
                                    arr[i] = { ...arr[i], value: v }
                                    patchAbout({ info_fields: arr })
                                  }} /></div>
                                  <button onClick={() => patchAbout({ info_fields: link.portfolio_ctx!.about!.info_fields!.filter((_, j) => j !== i) })}
                                    className="pb-2 text-steel hover:text-ember transition-colors"><Trash2 size={13} /></button>
                                </div>
                              ))}
                              <button onClick={() => patchAbout({ info_fields: [...(link.portfolio_ctx?.about?.info_fields ?? []), { label: '', value: '' }] })}
                                className="font-mono text-[11px] text-steel hover:text-blue transition-colors">+ Add field</button>
                            </div>
                          ) : (
                            <p className="font-mono text-[11px] text-silver">Using default values</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ── Interests ── */}
                    {ctxTab === 'interests' && (
                      <div className="space-y-1">
                        {interests.map(item => (
                          <div key={item.id} className="flex items-center justify-between py-2 border-b border-mist/50 last:border-0">
                            <span className="text-sm text-ink">{item.label}</span>
                            <VisibilityToggle
                              value={link.portfolio_ctx?.interests?.[String(item.id)]?.visibility ?? 'show'}
                              onChange={v => patchCtx({ interests: { ...(link.portfolio_ctx?.interests ?? {}), [String(item.id)]: { visibility: v as 'show' | 'highlight' | 'hide' } } })}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ── Testimonials ── */}
                    {ctxTab === 'testimonials' && (
                      <div className="space-y-1">
                        {testimonials.map(t => (
                          <div key={t.id} className="flex items-center justify-between py-2 border-b border-mist/50 last:border-0">
                            <div>
                              <span className="text-sm text-ink">{t.name}</span>
                              <span className="ml-2 font-mono text-[10px] text-silver">{t.role}</span>
                            </div>
                            <VisibilityToggle
                              value={link.portfolio_ctx?.testimonials?.[String(t.id)]?.visibility ?? 'show'}
                              onChange={v => patchCtx({ testimonials: { ...(link.portfolio_ctx?.testimonials ?? {}), [String(t.id)]: { visibility: v as 'show' | 'highlight' | 'hide' } } })}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-mist">
                      <button onClick={() => setTrackedLinks(prev => prev.map(l => l.id === link.id ? { ...l, portfolio_ctx: null } : l))}
                        className="font-mono text-[11px] text-steel hover:text-ember transition-colors">
                        Clear all customization
                      </button>
                      <span className="font-mono text-[10px] text-silver">Save using the row save button →</span>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        ))}
        </div>
        </div>
      </SectionCard>
    </motion.div>
  )
}
