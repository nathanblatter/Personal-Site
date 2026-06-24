import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { Plus, Trash2, Save, Eye, X, Check, ExternalLink, Copy, Award } from 'lucide-react'
import {
  api,
  type AboutResponse,
  type InterestResponse,
  type TestimonialResponse,
  type TestimonialRequestResponse,
  type CertificationResponse,
} from '../../lib/api'
import { AdminInput, AdminTextarea, SectionCard, FileUploadButton, type AdminCallbacks } from './AdminShared'

interface AboutSectionProps extends AdminCallbacks {
  about: AboutResponse | null
  setAbout: React.Dispatch<React.SetStateAction<AboutResponse | null>>
  interests: InterestResponse[]
  setInterests: React.Dispatch<React.SetStateAction<InterestResponse[]>>
  testimonials: TestimonialResponse[]
  setTestimonials: React.Dispatch<React.SetStateAction<TestimonialResponse[]>>
}

export default function AboutSection({ showToast, showError, about, setAbout, interests, setInterests, testimonials, setTestimonials }: AboutSectionProps) {
  const [headline, setHeadline] = useState(about?.bio_paragraphs[0] ?? '')
  const [bio, setBio] = useState(about?.bio_paragraphs[1] ?? '')
  const [hobbies, setHobbies] = useState(about?.bio_paragraphs[2] ?? '')

  const [testimonialReqs, setTestimonialReqs] = useState<TestimonialRequestResponse[]>([])
  const [tReqsLoaded, setTReqsLoaded] = useState(false)
  const [newReqForm, setNewReqForm] = useState({ slug: '', requester_name: '', requester_email: '', requester_role: '', personal_message: '' })
  const [showNewReqForm, setShowNewReqForm] = useState(false)
  const [expandedReq, setExpandedReq] = useState<number | null>(null)

  const [certs, setCerts] = useState<CertificationResponse[]>([])
  const [certsLoaded, setCertsLoaded] = useState(false)

  useEffect(() => {
    api.testimonialRequests.list()
      .then(r => { setTestimonialReqs(r); setTReqsLoaded(true) })
      .catch(err => showError((err as Error).message))
    api.certifications.list()
      .then(r => { setCerts(r); setCertsLoaded(true) })
      .catch(err => showError((err as Error).message))
  }, [showError])

  const updateCertLocal = (id: number, field: keyof CertificationResponse, value: string) => {
    setCerts(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  const addCert = async () => {
    try {
      const created = await api.certifications.create({ name: 'New Certification', issuer: 'Issuer', sort_order: certs.length })
      setCerts(prev => [...prev, created])
      showToast('Certification added')
    } catch (err) { showError((err as Error).message) }
  }

  const saveCert = async (cert: CertificationResponse) => {
    try {
      const updated = await api.certifications.update(cert.id, {
        name: cert.name, issuer: cert.issuer, verify_url: cert.verify_url,
        image_url: cert.image_url, image_key: cert.image_key, sort_order: cert.sort_order,
      })
      setCerts(prev => prev.map(c => c.id === updated.id ? updated : c))
      showToast(updated.verify_slug ? `Saved · tracked at /go/${updated.verify_slug}` : 'Certification saved')
    } catch (err) { showError((err as Error).message) }
  }

  const deleteCert = async (id: number) => {
    try {
      await api.certifications.delete(id)
      setCerts(prev => prev.filter(c => c.id !== id))
      showToast('Certification removed')
    } catch (err) { showError((err as Error).message) }
  }

  const saveAbout = async () => {
    if (!about) return
    try {
      const updated = await api.about.update({ bio_paragraphs: [headline, bio, hobbies], gpa: about.gpa, looking_for: about.looking_for })
      setAbout(updated)
      showToast('Bio saved')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const updateInterestLocal = (id: number, field: string, value: string) => {
    setInterests(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item))
  }

  const saveInterest = async (item: InterestResponse) => {
    try {
      const updated = await api.interests.update(item.id, item)
      setInterests(prev => prev.map(i => i.id === updated.id ? updated : i))
      showToast('Interest saved')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const addInterest = async () => {
    try {
      const created = await api.interests.create({
        icon: '',
        label: 'New Interest',
        desc: 'Description here',
        sort_order: interests.length,
      })
      setInterests(prev => [...prev, created])
      showToast('Interest added')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const deleteInterest = async (id: number) => {
    try {
      await api.interests.delete(id)
      setInterests(prev => prev.filter(i => i.id !== id))
      showToast('Interest removed')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div>
        <h2 className="text-2xl font-sans font-semibold text-ink mb-1">About Page</h2>
        <p className="text-steel text-sm">Edit your bio, interests, and personal details.</p>
      </div>

      <SectionCard>
        <h3 className="font-sans font-semibold text-ink mb-5">Bio</h3>
        <div className="space-y-5">
          <AdminTextarea label="Headline" value={headline} onChange={setHeadline} rows={2} />
          <AdminTextarea label="Main Paragraph" value={bio} onChange={setBio} rows={3} />
          <AdminTextarea label="Hobbies & Personal" value={hobbies} onChange={setHobbies} rows={2} />
          <AdminInput label="GPA" value={about?.gpa ?? ''} onChange={v => setAbout(prev => prev ? { ...prev, gpa: v } : prev)} placeholder="e.g. 3.64" mono />
        </div>
        <div className="flex justify-end pt-5">
          <button onClick={saveAbout} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors">
            <Save size={13} /> Save Bio
          </button>
        </div>
      </SectionCard>

      <SectionCard>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-sans font-semibold text-ink">Focus Areas / Interests</h3>
          <button onClick={addInterest} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-blue bg-blue-wash rounded-lg hover:bg-blue/10 transition-colors">
            <Plus size={12} /> Add
          </button>
        </div>
        <div className="space-y-3">
          {interests.map(item => (
            <div key={item.id} className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_auto] gap-3 sm:gap-4 items-start p-4 rounded-lg bg-white border border-mist">
              <input
                value={item.icon}
                onChange={e => updateInterestLocal(item.id, 'icon', e.target.value)}
                className="w-20 text-sm text-steel font-mono bg-transparent focus:outline-none focus:bg-snow focus:ring-2 focus:ring-blue/10 rounded px-2 py-1.5 transition-all border border-mist"
                placeholder="icon"
              />
              <input
                value={item.label}
                onChange={e => updateInterestLocal(item.id, 'label', e.target.value)}
                className="text-sm text-ink font-medium bg-transparent focus:outline-none focus:bg-snow focus:ring-2 focus:ring-blue/10 rounded px-2 py-1.5 -ml-2 transition-all"
                placeholder="Interest name"
              />
              <input
                value={item.desc}
                onChange={e => updateInterestLocal(item.id, 'desc', e.target.value)}
                className="text-sm text-steel bg-transparent focus:outline-none focus:bg-snow focus:ring-2 focus:ring-blue/10 rounded px-2 py-1.5 transition-all"
                placeholder="Short description"
              />
              <div className="flex items-center gap-1 mt-1">
                <button onClick={() => saveInterest(item)} className="p-1.5 text-steel hover:text-blue transition-colors">
                  <Save size={13} />
                </button>
                <button onClick={() => deleteInterest(item.id)} className="p-1.5 text-silver hover:text-ember transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Looking For */}
      <SectionCard>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-sans font-semibold text-ink">What I'm Looking For</h3>
          <button
            onClick={() => setAbout(prev => prev ? { ...prev, looking_for: [...(prev.looking_for || []), { role: '', location: '', timeline: '', detail: '' }] } : prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-blue bg-blue-wash rounded-lg hover:bg-blue/10 transition-colors"
          >
            <Plus size={12} /> Add
          </button>
        </div>
        <div className="space-y-3">
          {(about?.looking_for || []).map((item, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-start p-4 rounded-lg bg-white border border-mist">
              <input
                value={item.role}
                onChange={e => {
                  const next = [...(about?.looking_for || [])]
                  next[i] = { ...next[i], role: e.target.value }
                  setAbout(prev => prev ? { ...prev, looking_for: next } : prev)
                }}
                className="text-sm text-ink bg-transparent focus:outline-none focus:bg-snow focus:ring-2 focus:ring-blue/10 rounded px-2 py-1.5 transition-all border border-mist"
                placeholder="Role title"
              />
              <input
                value={item.location}
                onChange={e => {
                  const next = [...(about?.looking_for || [])]
                  next[i] = { ...next[i], location: e.target.value }
                  setAbout(prev => prev ? { ...prev, looking_for: next } : prev)
                }}
                className="text-sm text-steel bg-transparent focus:outline-none focus:bg-snow focus:ring-2 focus:ring-blue/10 rounded px-2 py-1.5 transition-all border border-mist"
                placeholder="Location"
              />
              <input
                value={item.timeline}
                onChange={e => {
                  const next = [...(about?.looking_for || [])]
                  next[i] = { ...next[i], timeline: e.target.value }
                  setAbout(prev => prev ? { ...prev, looking_for: next } : prev)
                }}
                className="text-sm text-steel bg-transparent focus:outline-none focus:bg-snow focus:ring-2 focus:ring-blue/10 rounded px-2 py-1.5 transition-all border border-mist"
                placeholder="Timeline"
              />
              <button
                onClick={() => setAbout(prev => prev ? { ...prev, looking_for: prev.looking_for.filter((_, j) => j !== i) } : prev)}
                className="p-1.5 text-silver hover:text-ember transition-colors mt-1"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-4">
          <button onClick={saveAbout} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors">
            <Save size={13} /> Save
          </button>
        </div>
      </SectionCard>

      {/* Testimonials */}
      <SectionCard>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-sans font-semibold text-ink">Testimonials</h3>
          <button
            onClick={async () => {
              try {
                const t = await api.testimonials.create({ name: 'New Person', role: 'Role', quote: 'Quote here...', sort_order: testimonials.length })
                setTestimonials(prev => [...prev, t])
                showToast('Testimonial added')
              } catch (err) { showError((err as Error).message) }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-blue bg-blue-wash rounded-lg hover:bg-blue/10 transition-colors"
          >
            <Plus size={12} /> Add
          </button>
        </div>
        <div className="space-y-3">
          {testimonials.map(t => (
            <div key={t.id} className="p-4 rounded-lg bg-white border border-mist space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  value={t.name}
                  onChange={e => setTestimonials(prev => prev.map(x => x.id === t.id ? { ...x, name: e.target.value } : x))}
                  className="text-sm text-ink font-medium bg-transparent focus:outline-none focus:bg-snow focus:ring-2 focus:ring-blue/10 rounded px-2 py-1.5 transition-all border border-mist"
                  placeholder="Name"
                />
                <input
                  value={t.role}
                  onChange={e => setTestimonials(prev => prev.map(x => x.id === t.id ? { ...x, role: e.target.value } : x))}
                  className="text-sm text-steel bg-transparent focus:outline-none focus:bg-snow focus:ring-2 focus:ring-blue/10 rounded px-2 py-1.5 transition-all border border-mist"
                  placeholder="Role / Title"
                />
              </div>
              <textarea
                value={t.quote}
                onChange={e => setTestimonials(prev => prev.map(x => x.id === t.id ? { ...x, quote: e.target.value } : x))}
                rows={2}
                className="w-full text-sm text-ink/80 bg-transparent focus:outline-none focus:bg-snow focus:ring-2 focus:ring-blue/10 rounded px-2 py-1.5 transition-all border border-mist resize-none"
                placeholder="Their quote..."
              />
              <div className="flex items-center justify-between">
                <input
                  value={t.avatar_url || ''}
                  onChange={e => setTestimonials(prev => prev.map(x => x.id === t.id ? { ...x, avatar_url: e.target.value } : x))}
                  className="flex-1 text-xs text-steel font-mono bg-transparent focus:outline-none focus:bg-snow focus:ring-2 focus:ring-blue/10 rounded px-2 py-1.5 transition-all border border-mist mr-2"
                  placeholder="Avatar URL (optional)"
                />
                <button
                  onClick={async () => {
                    try {
                      await api.testimonials.update(t.id, { name: t.name, role: t.role, quote: t.quote, avatar_url: t.avatar_url })
                      showToast('Saved')
                    } catch (err) { showError((err as Error).message) }
                  }}
                  className="p-1.5 text-steel hover:text-blue transition-colors"
                >
                  <Save size={13} />
                </button>
                <button
                  onClick={async () => {
                    try {
                      await api.testimonials.delete(t.id)
                      setTestimonials(prev => prev.filter(x => x.id !== t.id))
                      showToast('Deleted')
                    } catch (err) { showError((err as Error).message) }
                  }}
                  className="p-1.5 text-silver hover:text-ember transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          {testimonials.length === 0 && (
            <p className="text-center text-steel text-sm py-4 font-mono">No testimonials yet.</p>
          )}
        </div>
      </SectionCard>

      {/* Certifications */}
      <SectionCard>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-sans font-semibold text-ink flex items-center gap-2"><Award size={16} className="text-blue" /> Certifications</h3>
            <p className="text-xs text-steel font-mono mt-0.5">Each verify URL auto-creates a tracked /go/ link that counts clicks</p>
          </div>
          <button onClick={addCert} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-blue bg-blue-wash rounded-lg hover:bg-blue/10 transition-colors">
            <Plus size={12} /> Add
          </button>
        </div>
        <div className="space-y-3">
          {certs.map(cert => (
            <div key={cert.id} className="flex gap-4 p-4 rounded-lg bg-white border border-mist">
              {/* Logo */}
              <div className="shrink-0 flex flex-col items-center gap-2">
                <div className="w-16 h-16 rounded-lg bg-[#ffffff] border border-mist overflow-hidden flex items-center justify-center">
                  {cert.image_url
                    ? <img src={cert.image_url} alt={cert.name} className="w-full h-full object-contain p-1.5" />
                    : <Award size={20} className="text-silver" />}
                </div>
                <FileUploadButton
                  prefix="certs"
                  label="Logo"
                  accept="image/*"
                  onUploaded={(url, key) => setCerts(prev => prev.map(c => c.id === cert.id ? { ...c, image_url: url, image_key: key } : c))}
                />
              </div>
              {/* Fields */}
              <div className="flex-1 min-w-0 space-y-2">
                <input
                  value={cert.name}
                  onChange={e => updateCertLocal(cert.id, 'name', e.target.value)}
                  className="w-full text-sm text-ink font-medium bg-transparent focus:outline-none focus:bg-snow focus:ring-2 focus:ring-blue/10 rounded px-2 py-1.5 transition-all border border-mist"
                  placeholder="Certification name"
                />
                <input
                  value={cert.issuer}
                  onChange={e => updateCertLocal(cert.id, 'issuer', e.target.value)}
                  className="w-full text-sm text-steel bg-transparent focus:outline-none focus:bg-snow focus:ring-2 focus:ring-blue/10 rounded px-2 py-1.5 transition-all border border-mist"
                  placeholder="Issuer"
                />
                <input
                  value={cert.verify_url ?? ''}
                  onChange={e => updateCertLocal(cert.id, 'verify_url', e.target.value)}
                  className="w-full text-xs text-steel font-mono bg-transparent focus:outline-none focus:bg-snow focus:ring-2 focus:ring-blue/10 rounded px-2 py-1.5 transition-all border border-mist"
                  placeholder="Verify URL (https://…)"
                />
                {cert.verify_slug && (
                  <button
                    onClick={() => { navigator.clipboard.writeText(`https://nathanblatter.com/go/${cert.verify_slug}`); showToast('Tracked link copied') }}
                    className="inline-flex items-center gap-1.5 text-[11px] font-mono text-blue hover:underline"
                    title="Copy tracked link"
                  >
                    <ExternalLink size={11} /> /go/{cert.verify_slug} <Copy size={10} />
                  </button>
                )}
              </div>
              {/* Actions */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <button onClick={() => saveCert(cert)} className="p-1.5 text-steel hover:text-blue transition-colors" title="Save">
                  <Save size={13} />
                </button>
                <button onClick={() => deleteCert(cert.id)} className="p-1.5 text-silver hover:text-ember transition-colors" title="Delete">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          {certs.length === 0 && certsLoaded && (
            <p className="text-center text-steel text-sm py-4 font-mono">No certifications yet. Add one above.</p>
          )}
          {!certsLoaded && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4 p-4 rounded-lg bg-white border border-mist animate-pulse">
                  <div className="w-16 h-16 rounded-lg bg-mist shrink-0" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-8 bg-mist rounded" />
                    <div className="h-8 bg-mist rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Testimonial Requests */}
      <SectionCard>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-sans font-semibold text-ink">Testimonial Requests</h3>
            <p className="text-xs text-steel font-mono mt-0.5">Send personalized request links and approve submissions</p>
          </div>
          <button
            onClick={() => setShowNewReqForm(v => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-blue bg-blue-wash rounded-lg hover:bg-blue/10 transition-colors"
          >
            <Plus size={12} /> New Request
          </button>
        </div>

        {/* Create form */}
        {showNewReqForm && (
          <div className="mb-5 p-4 rounded-xl bg-snow border border-mist space-y-3">
            <p className="font-mono text-xs text-blue uppercase tracking-wider">New testimonial request</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-mono text-[10px] text-silver uppercase tracking-wider mb-1">Slug (URL)</label>
                <input
                  value={newReqForm.slug}
                  onChange={e => setNewReqForm(f => ({ ...f, slug: e.target.value }))}
                  placeholder="jamesgaskin"
                  className="w-full text-sm text-ink font-mono bg-white border border-mist rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue/20"
                />
                <p className="text-[10px] text-silver font-mono mt-1">→ /go/{newReqForm.slug || 'slug'}</p>
              </div>
              <div>
                <label className="block font-mono text-[10px] text-silver uppercase tracking-wider mb-1">Full name</label>
                <input
                  value={newReqForm.requester_name}
                  onChange={e => setNewReqForm(f => ({ ...f, requester_name: e.target.value }))}
                  placeholder="James Gaskin"
                  className="w-full text-sm text-ink bg-white border border-mist rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue/20"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] text-silver uppercase tracking-wider mb-1">Email (optional)</label>
                <input
                  value={newReqForm.requester_email}
                  onChange={e => setNewReqForm(f => ({ ...f, requester_email: e.target.value }))}
                  placeholder="james@example.com"
                  type="email"
                  className="w-full text-sm text-ink bg-white border border-mist rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue/20"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] text-silver uppercase tracking-wider mb-1">Their role (optional)</label>
                <input
                  value={newReqForm.requester_role}
                  onChange={e => setNewReqForm(f => ({ ...f, requester_role: e.target.value }))}
                  placeholder="Professor at BYU"
                  className="w-full text-sm text-ink bg-white border border-mist rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue/20"
                />
              </div>
            </div>
            <div>
              <label className="block font-mono text-[10px] text-silver uppercase tracking-wider mb-1">Personal message (optional)</label>
              <textarea
                value={newReqForm.personal_message}
                onChange={e => setNewReqForm(f => ({ ...f, personal_message: e.target.value }))}
                rows={2}
                placeholder="Appears in the email and on the form — personalize it."
                className="w-full text-sm text-ink bg-white border border-mist rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue/20 resize-none"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={async () => {
                  if (!newReqForm.slug || !newReqForm.requester_name) { showError('Slug and name are required'); return }
                  try {
                    const created = await api.testimonialRequests.create({
                      slug: newReqForm.slug,
                      requester_name: newReqForm.requester_name,
                      requester_email: newReqForm.requester_email || undefined,
                      requester_role: newReqForm.requester_role || undefined,
                      personal_message: newReqForm.personal_message || undefined,
                    })
                    setTestimonialReqs(prev => [created, ...prev])
                    setNewReqForm({ slug: '', requester_name: '', requester_email: '', requester_role: '', personal_message: '' })
                    setShowNewReqForm(false)
                    showToast('Request created')
                  } catch (err) { showError((err as Error).message) }
                }}
                className="px-4 py-2 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => setShowNewReqForm(false)}
                className="px-4 py-2 text-steel font-mono text-xs rounded-lg hover:bg-mist transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Request list */}
        <div className="space-y-2">
          {testimonialReqs.map(req => {
            const statusColors: Record<string, string> = {
              pending: 'bg-silver/10 text-silver',
              sent: 'bg-blue-wash text-blue',
              submitted: 'bg-amber-50 text-amber-600 border border-amber-200',
              approved: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
              rejected: 'bg-ember/10 text-ember',
            }
            const isExpanded = expandedReq === req.id
            return (
              <div key={req.id} className="rounded-xl border border-mist bg-white overflow-hidden">
                {/* Row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-ink">{req.requester_name}</span>
                      {req.requester_role && <span className="text-xs text-steel">{req.requester_role}</span>}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wide ${statusColors[req.status] ?? 'bg-mist text-steel'}`}>
                        {req.status}
                      </span>
                    </div>
                    <p className="text-xs text-silver font-mono mt-0.5">/go/{req.slug}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Copy link */}
                    <button
                      title="Copy link"
                      onClick={() => { navigator.clipboard.writeText(`https://nathanblatter.com/go/${req.slug}`); showToast('Link copied') }}
                      className="p-1.5 text-silver hover:text-blue transition-colors"
                    >
                      <Copy size={13} />
                    </button>

                    {/* Send / resend email */}
                    {req.requester_email && req.status !== 'approved' && req.status !== 'rejected' && (
                      <button
                        title={req.status === 'sent' ? 'Resend email' : 'Send email'}
                        onClick={async () => {
                          try {
                            await api.testimonialRequests.sendEmail(req.id)
                            setTestimonialReqs(prev => prev.map(r => r.id === req.id ? { ...r, status: r.status === 'pending' ? 'sent' : r.status } : r))
                            showToast('Email sent')
                          } catch (err) { showError((err as Error).message) }
                        }}
                        className="p-1.5 text-silver hover:text-blue transition-colors"
                      >
                        <ExternalLink size={13} />
                      </button>
                    )}

                    {/* Expand to see submission */}
                    {req.status === 'submitted' && (
                      <button
                        title="View submission"
                        onClick={() => setExpandedReq(isExpanded ? null : req.id)}
                        className="p-1.5 text-silver hover:text-blue transition-colors"
                      >
                        <Eye size={13} />
                      </button>
                    )}

                    {/* Approve */}
                    {req.status === 'submitted' && (
                      <button
                        title="Approve"
                        onClick={async () => {
                          try {
                            const updated = await api.testimonialRequests.approve(req.id)
                            setTestimonialReqs(prev => prev.map(r => r.id === req.id ? updated : r))
                            showToast('Approved — testimonial created')
                          } catch (err) { showError((err as Error).message) }
                        }}
                        className="p-1.5 text-silver hover:text-emerald-600 transition-colors"
                      >
                        <Check size={13} />
                      </button>
                    )}

                    {/* Reject */}
                    {['submitted', 'sent', 'pending'].includes(req.status) && (
                      <button
                        title="Reject"
                        onClick={async () => {
                          try {
                            const updated = await api.testimonialRequests.reject(req.id)
                            setTestimonialReqs(prev => prev.map(r => r.id === req.id ? updated : r))
                            showToast('Rejected')
                          } catch (err) { showError((err as Error).message) }
                        }}
                        className="p-1.5 text-silver hover:text-ember transition-colors"
                      >
                        <X size={13} />
                      </button>
                    )}

                    {/* Delete */}
                    <button
                      title="Delete"
                      onClick={async () => {
                        try {
                          await api.testimonialRequests.delete(req.id)
                          setTestimonialReqs(prev => prev.filter(r => r.id !== req.id))
                          showToast('Deleted')
                        } catch (err) { showError((err as Error).message) }
                      }}
                      className="p-1.5 text-silver hover:text-ember transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Expanded submission content */}
                {isExpanded && req.submitted_quote && (
                  <div className="px-4 pb-4 pt-1 border-t border-mist bg-snow space-y-2">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-medium text-ink">{req.submitted_name}</span>
                      {req.submitted_role && <span className="text-steel">{req.submitted_role}</span>}
                      {req.submitted_avatar_url && (
                        <img src={req.submitted_avatar_url} alt="" className="w-6 h-6 rounded-full object-cover border border-mist" />
                      )}
                    </div>
                    <blockquote className="text-sm text-ink/80 italic leading-relaxed pl-3 border-l-2 border-blue/30">
                      &ldquo;{req.submitted_quote}&rdquo;
                    </blockquote>
                  </div>
                )}
              </div>
            )
          })}
          {testimonialReqs.length === 0 && tReqsLoaded && (
            <p className="text-center text-steel text-sm py-4 font-mono">No requests yet. Create one above.</p>
          )}
          {!tReqsLoaded && (
            <p className="text-center text-steel text-sm py-4 font-mono">Loading…</p>
          )}
        </div>
      </SectionCard>
    </motion.div>
  )
}
