import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Plus, Trash2, GripVertical, Save, Eye, EyeOff, Check, Pencil, ExternalLink, Download } from 'lucide-react'
import { api, type BioLinkResponse, type BioPageSettingsResponse } from '../../lib/api'
import { AdminInput, SectionCard, type AdminCallbacks } from './AdminShared'

export default function BioSection({ showToast, showError }: AdminCallbacks) {
  const [bioLinks, setBioLinks] = useState<BioLinkResponse[]>([])
  const [bioSettings, setBioSettings] = useState<BioPageSettingsResponse>({ heading: 'Nathan Blatter', subheading: '', avatar_url: '', show_portfolio_link: true, show_booking_link: true })
  const [bioEditLink, setBioEditLink] = useState<BioLinkResponse | null>(null)
  const [bioNewLink, setBioNewLink] = useState({ title: '', url: '', description: '', icon: '', category: '', featured: false })
  const [bioShowNew, setBioShowNew] = useState(false)

  useEffect(() => {
    Promise.all([api.bio.links.list(), api.bio.settings.get()])
      .then(([links, settings]) => { setBioLinks(links); setBioSettings(settings) })
      .catch(err => showError((err as Error).message))
  }, [showError])

  const maxClicks = Math.max(1, ...bioLinks.map(l => l.clicks))
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-sans font-semibold text-ink mb-1">Link in Bio</h2>
          <p className="text-steel text-sm">{bioLinks.length} link{bioLinks.length !== 1 ? 's' : ''} configured</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/linkinbio"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-mist text-steel font-mono text-xs font-semibold rounded-lg hover:text-blue hover:border-blue/30 transition-all"
          >
            <ExternalLink size={14} /> Open /linkinbio
          </a>
        </div>
      </div>

      {/* ── Settings ── */}
      <SectionCard>
        <h3 className="font-mono text-[11px] text-steel tracking-wider uppercase mb-5">Page Settings</h3>
        <div className="grid grid-cols-2 gap-5 mb-5">
          <AdminInput label="Heading" value={bioSettings.heading} onChange={v => setBioSettings(s => ({ ...s, heading: v }))} />
          <AdminInput label="Subheading" value={bioSettings.subheading ?? ''} onChange={v => setBioSettings(s => ({ ...s, subheading: v }))} />
          <AdminInput label="Avatar URL" value={bioSettings.avatar_url ?? ''} onChange={v => setBioSettings(s => ({ ...s, avatar_url: v }))} mono />
        </div>
        <div className="flex items-center gap-6 mb-5">
          <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={bioSettings.show_portfolio_link}
              onChange={e => setBioSettings(s => ({ ...s, show_portfolio_link: e.target.checked }))}
              className="rounded border-mist text-blue focus:ring-blue/20"
            />
            Show portfolio link
          </label>
          <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={bioSettings.show_booking_link}
              onChange={e => setBioSettings(s => ({ ...s, show_booking_link: e.target.checked }))}
              className="rounded border-mist text-blue focus:ring-blue/20"
            />
            Show booking link
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              api.bio.settings.update(bioSettings)
                .then(s => { setBioSettings(s); showToast('Settings saved') })
                .catch(err => showError((err as Error).message))
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors shadow-sm"
          >
            <Save size={14} /> Save Settings
          </button>
        </div>
      </SectionCard>

      {/* ── QR Code ── */}
      <SectionCard>
        <h3 className="font-mono text-[11px] text-steel tracking-wider uppercase mb-4">QR Code</h3>
        <div className="flex items-start gap-6">
          <img
            src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://nathanblatter.com/linkinbio"
            alt="QR Code for linkinbio"
            className="w-[200px] h-[200px] border border-mist rounded-lg"
          />
          <div className="space-y-3">
            <p className="text-sm text-steel">Scan to open <span className="font-mono text-ink">nathanblatter.com/linkinbio</span></p>
            <a
              href="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://nathanblatter.com/linkinbio"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 border border-mist text-steel font-mono text-xs rounded-lg hover:text-blue hover:border-blue/30 transition-all"
            >
              <Download size={14} /> Download QR
            </a>
          </div>
        </div>
      </SectionCard>

      {/* ── Links Management ── */}
      <SectionCard>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-mono text-[11px] text-steel tracking-wider uppercase">Links</h3>
          <button
            onClick={() => setBioShowNew(!bioShowNew)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors shadow-sm"
          >
            <Plus size={14} /> Add Link
          </button>
        </div>

        {/* New link form */}
        <AnimatePresence>
          {bioShowNew && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="border border-mist rounded-lg p-5 mb-5 bg-cloud/30 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <AdminInput label="Title" value={bioNewLink.title} onChange={v => setBioNewLink(p => ({ ...p, title: v }))} />
                  <AdminInput label="URL" value={bioNewLink.url} onChange={v => setBioNewLink(p => ({ ...p, url: v }))} mono />
                  <AdminInput label="Description" value={bioNewLink.description} onChange={v => setBioNewLink(p => ({ ...p, description: v }))} />
                  <AdminInput label="Icon (emoji or text)" value={bioNewLink.icon} onChange={v => setBioNewLink(p => ({ ...p, icon: v }))} />
                  <AdminInput label="Category" value={bioNewLink.category} onChange={v => setBioNewLink(p => ({ ...p, category: v }))} />
                  <label className="flex items-center gap-2 text-sm text-ink cursor-pointer self-end pb-2">
                    <input type="checkbox" checked={bioNewLink.featured} onChange={e => setBioNewLink(p => ({ ...p, featured: e.target.checked }))} className="rounded border-mist text-blue focus:ring-blue/20" />
                    Featured
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      api.bio.links.create({ ...bioNewLink, enabled: true, sort_order: bioLinks.length })
                        .then(link => {
                          setBioLinks(prev => [...prev, link])
                          setBioNewLink({ title: '', url: '', description: '', icon: '', category: '', featured: false })
                          setBioShowNew(false)
                          showToast('Link created')
                        })
                        .catch(err => showError((err as Error).message))
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors"
                  >
                    <Check size={14} /> Create
                  </button>
                  <button onClick={() => setBioShowNew(false)} className="px-4 py-2.5 text-steel font-mono text-xs rounded-lg hover:bg-cloud transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Links list */}
        {bioLinks.length === 0 && !bioShowNew && (
          <p className="text-center text-steel text-sm py-8 font-mono">No links yet. Add one to get started.</p>
        )}
        <div className="space-y-3">
          {bioLinks.map(link => (
            <div key={link.id} className="border border-mist rounded-lg overflow-hidden hover:border-blue/20 transition-colors">
              {bioEditLink?.id === link.id ? (
                /* Inline edit mode */
                <div className="p-5 bg-cloud/30 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <AdminInput label="Title" value={bioEditLink.title} onChange={v => setBioEditLink(p => p ? { ...p, title: v } : p)} />
                    <AdminInput label="URL" value={bioEditLink.url} onChange={v => setBioEditLink(p => p ? { ...p, url: v } : p)} mono />
                    <AdminInput label="Description" value={bioEditLink.description ?? ''} onChange={v => setBioEditLink(p => p ? { ...p, description: v } : p)} />
                    <AdminInput label="Icon" value={bioEditLink.icon ?? ''} onChange={v => setBioEditLink(p => p ? { ...p, icon: v } : p)} />
                    <AdminInput label="Category" value={bioEditLink.category ?? ''} onChange={v => setBioEditLink(p => p ? { ...p, category: v } : p)} />
                    <AdminInput label="Sort Order" value={String(bioEditLink.sort_order)} onChange={v => setBioEditLink(p => p ? { ...p, sort_order: parseInt(v) || 0 } : p)} />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
                    <input type="checkbox" checked={bioEditLink.featured} onChange={e => setBioEditLink(p => p ? { ...p, featured: e.target.checked } : p)} className="rounded border-mist text-blue focus:ring-blue/20" />
                    Featured
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const data: Partial<BioLinkResponse> = { ...bioEditLink }
                        delete data.id
                        delete data.clicks
                        api.bio.links.update(bioEditLink.id, data)
                          .then(updated => {
                            setBioLinks(prev => prev.map(l => l.id === updated.id ? updated : l))
                            setBioEditLink(null)
                            showToast('Link updated')
                          })
                          .catch(err => showError((err as Error).message))
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors"
                    >
                      <Save size={14} /> Save
                    </button>
                    <button onClick={() => setBioEditLink(null)} className="px-4 py-2.5 text-steel font-mono text-xs rounded-lg hover:bg-cloud transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* Display mode */
                <div className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Sort order handle */}
                    <div className="flex items-center gap-1 text-silver shrink-0">
                      <GripVertical size={14} />
                      <span className="font-mono text-[10px] w-5 text-center">{link.sort_order}</span>
                    </div>

                    {/* Icon */}
                    {link.icon && <span className="text-lg shrink-0">{link.icon}</span>}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-ink">{link.title}</span>
                        {link.featured && (
                          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full bg-blue/10 text-blue uppercase tracking-wider">Featured</span>
                        )}
                        {link.category && (
                          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full bg-cloud text-steel uppercase tracking-wider">{link.category}</span>
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-steel truncate block">{link.url}</span>
                    </div>

                    {/* Click analytics */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="w-24">
                        <div className="h-1.5 rounded-full bg-mist overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue transition-all"
                            style={{ width: `${(link.clicks / maxClicks) * 100}%` }}
                          />
                        </div>
                      </div>
                      <span className="font-mono text-xs font-semibold text-ink w-10 text-right">{link.clicks}</span>
                    </div>

                    {/* Enabled toggle */}
                    <button
                      onClick={() => {
                        api.bio.links.update(link.id, { enabled: !link.enabled })
                          .then(updated => setBioLinks(prev => prev.map(l => l.id === updated.id ? updated : l)))
                          .catch(err => showError((err as Error).message))
                      }}
                      className={`p-1.5 rounded transition-colors ${link.enabled ? 'text-teal hover:text-teal/70' : 'text-silver hover:text-steel'}`}
                      title={link.enabled ? 'Enabled' : 'Disabled'}
                    >
                      {link.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>

                    {/* Actions */}
                    <button onClick={() => setBioEditLink({ ...link })} className="p-1.5 text-steel hover:text-blue transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => {
                        api.bio.links.delete(link.id)
                          .then(() => { setBioLinks(prev => prev.filter(l => l.id !== link.id)); showToast('Link deleted') })
                          .catch(err => showError((err as Error).message))
                      }}
                      className="p-1.5 text-steel hover:text-ember transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionCard>
    </motion.div>
  )
}
