import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Plus, Trash2, GripVertical, Save, Pencil } from 'lucide-react'
import { api, type SocialResponse, type ContactMetaResponse } from '../../lib/api'
import { AdminInput, AdminTextarea, SectionCard, type AdminCallbacks } from './AdminShared'
import { useUnsavedWarning } from './useUnsavedWarning'

interface ContactSectionProps extends AdminCallbacks {
  socials: SocialResponse[]
  setSocials: React.Dispatch<React.SetStateAction<SocialResponse[]>>
  contactMeta: ContactMetaResponse | null
  setContactMeta: React.Dispatch<React.SetStateAction<ContactMetaResponse | null>>
}

export default function ContactSection({ showToast, showError, socials, setSocials, contactMeta, setContactMeta }: ContactSectionProps) {
  const [editingSocial, setEditingSocial] = useState<number | null>(null)
  useUnsavedWarning(editingSocial !== null)

  const updateSocialLocal = (id: number, field: string, value: string) => {
    setSocials(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  const saveSocial = async (social: SocialResponse) => {
    try {
      const updated = await api.socials.update(social.id, social)
      setSocials(prev => prev.map(s => s.id === updated.id ? updated : s))
      setEditingSocial(null)
      showToast('Social link updated')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const addSocial = async () => {
    try {
      const created = await api.socials.create({
        icon: 'Link',
        label: 'New Link',
        handle: '@handle',
        href: 'https://',
        sort_order: socials.length,
      })
      setSocials(prev => [...prev, created])
      setEditingSocial(created.id)
      showToast('Social link added')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const deleteSocial = async (id: number) => {
    try {
      await api.socials.delete(id)
      setSocials(prev => prev.filter(s => s.id !== id))
      if (editingSocial === id) setEditingSocial(null)
      showToast('Social link deleted')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const saveContactMeta = async () => {
    if (!contactMeta) return
    try {
      const updated = await api.contact.update(contactMeta)
      setContactMeta(updated)
      showToast('Contact info saved')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div>
        <h2 className="text-2xl font-sans font-semibold text-ink mb-1">Contact Info</h2>
        <p className="text-steel text-sm">Social links and contact details shown on the Contact page.</p>
      </div>

      {/* Social links */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-sans font-semibold text-ink">Social Links</h3>
          <button onClick={addSocial} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-blue bg-blue-wash rounded-lg hover:bg-blue/10 transition-colors">
            <Plus size={12} /> Add
          </button>
        </div>

        <div className="space-y-3">
          {socials.map(social => (
            <SectionCard key={social.id} className="!p-0 overflow-hidden">
              <div
                className="flex items-center gap-4 p-5 cursor-pointer hover:bg-cloud/50 transition-colors"
                onClick={() => setEditingSocial(editingSocial === social.id ? null : social.id)}
              >
                <GripVertical size={14} className="text-silver" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-ink">{social.label}</span>
                  <p className="text-xs text-steel font-mono mt-0.5">{social.handle}</p>
                </div>
                <span className="font-mono text-xs text-silver truncate max-w-48 shrink-0">{social.href}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={e => { e.stopPropagation(); setEditingSocial(editingSocial === social.id ? null : social.id) }} className="p-1.5 text-steel hover:text-blue transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); deleteSocial(social.id) }} className="p-1.5 text-steel hover:text-ember transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {editingSocial === social.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-mist p-6 bg-white space-y-5">
                      <div className="grid grid-cols-2 gap-5">
                        <AdminInput label="Label" value={social.label} onChange={v => updateSocialLocal(social.id, 'label', v)} />
                        <AdminInput label="Icon name" value={social.icon} onChange={v => updateSocialLocal(social.id, 'icon', v)} mono placeholder="Github, Linkedin, Mail…" />
                      </div>
                      <div className="grid grid-cols-2 gap-5">
                        <AdminInput label="Handle / Display text" value={social.handle} onChange={v => updateSocialLocal(social.id, 'handle', v)} mono />
                        <AdminInput label="URL / href" value={social.href} onChange={v => updateSocialLocal(social.id, 'href', v)} mono placeholder="https://…" />
                      </div>
                      <div className="flex justify-end pt-2">
                        <button onClick={() => saveSocial(social)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors">
                          <Save size={13} /> Save Changes
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </SectionCard>
          ))}
        </div>
      </div>

      {/* Page meta */}
      {contactMeta && (
        <SectionCard>
          <h3 className="font-sans font-semibold text-ink mb-5">Page Meta</h3>
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-5">
              <AdminInput label="Heading" value={contactMeta.heading} onChange={v => setContactMeta(prev => prev ? { ...prev, heading: v } : prev)} />
              <AdminInput label="Subheading" value={contactMeta.subheading} onChange={v => setContactMeta(prev => prev ? { ...prev, subheading: v } : prev)} />
            </div>
            <AdminTextarea label="Body Text" value={contactMeta.body_text} onChange={v => setContactMeta(prev => prev ? { ...prev, body_text: v } : prev)} rows={3} />
            <AdminInput label="Location Text" value={contactMeta.location_text} onChange={v => setContactMeta(prev => prev ? { ...prev, location_text: v } : prev)} />
          </div>
          <div className="flex justify-end pt-5">
            <button onClick={saveContactMeta} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors">
              <Save size={13} /> Save Meta
            </button>
          </div>
        </SectionCard>
      )}
    </motion.div>
  )
}
