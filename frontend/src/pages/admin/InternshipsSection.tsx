import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Plus, Trash2, X, Loader2, Target, Building2, TrendingUp,
  Globe, Clock, MapPin, Link2,
} from 'lucide-react'
import {
  api,
  type ApplicationListItem,
  type CompanyResponse,
  type DashboardStats,
  type TagResponse as ITagResponse,
} from '../../lib/api'
import { AdminInput, AdminTextarea, AdminSelect, SectionCard, type AdminCallbacks } from './AdminShared'

const STATUS_PIPELINE: { key: string; label: string; color: string }[] = [
  { key: 'wishlist', label: 'Wishlist', color: '#c8d0db' },
  { key: 'drafting', label: 'Drafting', color: '#8c95a6' },
  { key: 'applied', label: 'Applied', color: '#3b6cf5' },
  { key: 'online_assessment', label: 'OA', color: '#7c5cf5' },
  { key: 'recruiter_screen', label: 'Recruiter', color: '#38b2ac' },
  { key: 'phone_screen', label: 'Phone', color: '#38b2ac' },
  { key: 'technical', label: 'Technical', color: '#2a54d4' },
  { key: 'onsite', label: 'Onsite', color: '#1a1f2e' },
  { key: 'final_round', label: 'Final', color: '#5b8af7' },
  { key: 'offer', label: 'Offer', color: '#38b2ac' },
  { key: 'accepted', label: 'Accepted', color: '#22c55e' },
  { key: 'declined', label: 'Declined', color: '#f59e0b' },
  { key: 'rejected', label: 'Rejected', color: '#e25555' },
  { key: 'withdrawn', label: 'Withdrawn', color: '#8c95a6' },
  { key: 'ghosted', label: 'Ghosted', color: '#c8d0db' },
]

const PRIORITY_COLORS: Record<string, string> = {
  dream: 'bg-violet/15 text-violet border-violet/30',
  high: 'bg-blue/10 text-blue border-blue/30',
  medium: 'bg-teal/10 text-teal border-teal/30',
  low: 'bg-steel/10 text-steel border-steel/30',
  backup: 'bg-silver/20 text-steel border-silver/40',
}

const PIPELINE_STAGES = ['wishlist', 'applied', 'online_assessment', 'recruiter_screen', 'phone_screen', 'technical', 'onsite', 'final_round', 'offer']
const TERMINAL_STAGES = ['accepted', 'declined', 'rejected', 'withdrawn', 'ghosted']

export default function InternshipsSection({ showToast, showError }: AdminCallbacks) {
  const [intApps, setIntApps] = useState<ApplicationListItem[]>([])
  const [, setIntCompanies] = useState<CompanyResponse[]>([])
  const [intDashboard, setIntDashboard] = useState<DashboardStats | null>(null)
  const [, setIntTags] = useState<ITagResponse[]>([])
  const [intView, setIntView] = useState<'dashboard' | 'pipeline' | 'list' | 'add'>('dashboard')
  const [intEditing, setIntEditing] = useState<string | null>(null)
  const [intLoaded, setIntLoaded] = useState(false)
  const [intForm, setIntForm] = useState<Record<string, string>>({
    company_name: '', job_title: '', team: '', role_type: 'internship',
    work_arrangement: '', location_city: '', posting_url: '',
    current_status: 'wishlist', priority: 'medium', source: '',
    applied_on: '', next_action: '', next_action_due: '', personal_notes: '',
  })

  const refreshInternships = async () => {
    try {
      const [dash, apps, companies, tags] = await Promise.all([
        api.internships.dashboard(),
        api.internships.applications.list(),
        api.internships.companies.list(),
        api.internships.tags.list(),
      ])
      setIntDashboard(dash)
      setIntApps(apps)
      setIntCompanies(companies)
      setIntTags(tags)
    } catch (err) {
      showError((err as Error).message)
    }
  }

  useEffect(() => {
    Promise.all([
      api.internships.dashboard(),
      api.internships.applications.list(),
      api.internships.companies.list(),
      api.internships.tags.list(),
    ]).then(([dash, apps, companies, tags]) => {
      setIntDashboard(dash)
      setIntApps(apps)
      setIntCompanies(companies)
      setIntTags(tags)
      setIntLoaded(true)
    }).catch(err => showError((err as Error).message))
  }, [showError])

  const addApplication = async (form: Record<string, string>) => {
    try {
      await api.internships.applications.create({
        company_name: form.company_name,
        job_title: form.job_title,
        team: form.team || undefined,
        role_type: form.role_type || 'internship',
        work_arrangement: form.work_arrangement || undefined,
        location_city: form.location_city || undefined,
        posting_url: form.posting_url || undefined,
        current_status: form.current_status || 'wishlist',
        priority: form.priority || 'medium',
        source: form.source || undefined,
        applied_on: form.applied_on || undefined,
        next_action: form.next_action || undefined,
        next_action_due: form.next_action_due || undefined,
        personal_notes: form.personal_notes || undefined,
      })
      await refreshInternships()
      setIntForm({
        company_name: '', job_title: '', team: '', role_type: 'internship',
        work_arrangement: '', location_city: '', posting_url: '',
        current_status: 'wishlist', priority: 'medium', source: '',
        applied_on: '', next_action: '', next_action_due: '', personal_notes: '',
      })
      setIntView('pipeline')
      showToast('Application added')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const updateAppStatus = async (appId: string, newStatus: string) => {
    try {
      await api.internships.applications.addStatus(appId, { status: newStatus })
      await refreshInternships()
      showToast(`Status updated to ${newStatus}`)
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const deleteApplication = async (appId: string) => {
    try {
      await api.internships.applications.delete(appId)
      await refreshInternships()
      showToast('Application archived')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  if (!intLoaded) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center py-32">
        <Loader2 size={24} className="animate-spin text-blue" />
      </motion.div>
    )
  }

  const dash = intDashboard

  const renderIntDashboard = () => (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: 'Total Apps', value: dash?.total_applications ?? 0, sub: `${dash?.response_rate ? (dash.response_rate * 100).toFixed(0) : 0}% response rate`, color: 'blue' },
          { label: 'Active', value: intApps.filter(a => !['rejected', 'withdrawn', 'ghosted', 'accepted', 'declined'].includes(a.current_status)).length, sub: 'in pipeline', color: 'teal' },
          { label: 'Offers', value: dash?.status_counts?.offer ?? 0, sub: `${dash?.offer_rate ? (dash.offer_rate * 100).toFixed(0) : 0}% offer rate`, color: 'violet' },
          { label: 'Interviews', value: intApps.filter(a => ['technical', 'onsite', 'final_round', 'phone_screen', 'recruiter_screen', 'online_assessment'].includes(a.current_status)).length, sub: 'scheduled / done', color: 'ember' },
        ].map(card => (
          <SectionCard key={card.label}>
            <div className="flex items-start justify-between mb-3">
              <span className="font-mono text-[11px] text-steel tracking-wider uppercase">{card.label}</span>
              <span className={`w-2 h-2 rounded-full bg-${card.color} mt-1`} />
            </div>
            <p className="text-3xl font-sans font-bold text-ink">{card.value}</p>
            <p className="text-xs text-steel mt-1 font-mono">{card.sub}</p>
          </SectionCard>
        ))}
      </div>

      <SectionCard>
        <h3 className="font-sans font-semibold text-ink mb-6 flex items-center gap-2">
          <TrendingUp size={16} className="text-blue" /> Pipeline Funnel
        </h3>
        <div className="space-y-2">
          {STATUS_PIPELINE.filter(s => (dash?.status_counts?.[s.key] ?? 0) > 0 || ['wishlist', 'applied', 'technical', 'offer', 'accepted', 'rejected'].includes(s.key)).map(stage => {
            const count = dash?.status_counts?.[stage.key] ?? 0
            const max = Math.max(...Object.values(dash?.status_counts ?? { a: 1 }), 1)
            const pct = (count / max) * 100
            return (
              <div key={stage.key} className="flex items-center gap-3 group">
                <span className="font-mono text-[11px] text-steel w-20 text-right shrink-0">{stage.label}</span>
                <div className="flex-1 h-8 bg-cloud rounded-lg overflow-hidden relative">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(pct, count > 0 ? 3 : 0)}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="h-full rounded-lg relative"
                    style={{ backgroundColor: stage.color }}
                  />
                  {count > 0 && (
                    <span className="absolute inset-y-0 left-3 flex items-center font-mono text-xs font-bold text-white mix-blend-difference">
                      {count}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <SectionCard>
          <h3 className="font-sans font-semibold text-ink mb-4 flex items-center gap-2">
            <Globe size={16} className="text-blue" /> Application Sources
          </h3>
          <div className="space-y-3">
            {Object.entries(dash?.source_counts ?? {}).sort(([, a], [, b]) => b - a).slice(0, 6).map(([source, count]) => (
              <div key={source} className="flex items-center justify-between">
                <span className="text-sm text-ink capitalize">{source.replace(/_/g, ' ')}</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-cloud rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-blue-dim to-blue-light" style={{ width: `${(count / Math.max(...Object.values(dash?.source_counts ?? { a: 1 }), 1)) * 100}%` }} />
                  </div>
                  <span className="font-mono text-[11px] text-steel w-6 text-right">{count}</span>
                </div>
              </div>
            ))}
            {Object.keys(dash?.source_counts ?? {}).length === 0 && (
              <p className="text-sm text-steel italic">No applications yet</p>
            )}
          </div>
        </SectionCard>

        <SectionCard>
          <h3 className="font-sans font-semibold text-ink mb-4 flex items-center gap-2">
            <Target size={16} className="text-violet" /> By Priority
          </h3>
          <div className="space-y-3">
            {['dream', 'high', 'medium', 'low', 'backup'].map(p => {
              const count = dash?.priority_counts?.[p] ?? 0
              return (
                <div key={p} className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] px-2.5 py-1 rounded-full border capitalize ${PRIORITY_COLORS[p]}`}>
                    {p}
                  </span>
                  <span className="font-mono text-sm font-bold text-ink">{count}</span>
                </div>
              )
            })}
          </div>
        </SectionCard>
      </div>

      {(dash?.upcoming_actions?.length ?? 0) > 0 && (
        <SectionCard>
          <h3 className="font-sans font-semibold text-ink mb-4 flex items-center gap-2">
            <Clock size={16} className="text-ember" /> Upcoming Actions
          </h3>
          <div className="space-y-2">
            {dash!.upcoming_actions.map(a => (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-white border border-mist">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Building2 size={14} className="text-steel shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm text-ink font-medium block truncate">{a.company_name} — {a.job_title}</span>
                    <span className="text-xs text-steel">{a.next_action}</span>
                  </div>
                </div>
                <span className="font-mono text-[11px] text-ember shrink-0 ml-3">{a.next_action_due}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )

  const renderPipeline = () => {
    const allStages = [...PIPELINE_STAGES, ...TERMINAL_STAGES]
    const stageApps = allStages
      .map(stage => ({
        stage,
        label: STATUS_PIPELINE.find(s => s.key === stage)?.label ?? stage,
        color: STATUS_PIPELINE.find(s => s.key === stage)?.color ?? '#999',
        apps: intApps.filter(a => a.current_status === stage),
        isTerminal: TERMINAL_STAGES.includes(stage),
      }))
      .filter(s => s.apps.length > 0)

    return (
      <div className="space-y-3">
        {stageApps.map(group => (
          <div key={group.stage}>
            <div className="flex items-center gap-2.5 mb-2 px-1">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
              <span className="font-mono text-[11px] text-steel tracking-wider uppercase">{group.label}</span>
              <div className="flex-1 h-px bg-mist" />
              <span className="font-mono text-[11px] text-silver">{group.apps.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
              {group.apps.map(app => (
                <motion.div
                  key={app.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-white border border-mist rounded-lg p-3.5 cursor-pointer hover:border-blue/30 hover:shadow-sm transition-all ${group.isTerminal ? 'opacity-60' : ''}`}
                  onClick={() => setIntEditing(intEditing === app.id ? null : app.id)}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-sm font-medium text-ink leading-tight">{app.company_name}</span>
                    <span className={`inline-flex items-center font-mono text-[9px] px-1.5 py-0.5 rounded-full border shrink-0 ml-2 ${PRIORITY_COLORS[app.priority]}`}>
                      {app.priority}
                    </span>
                  </div>
                  <p className="text-xs text-steel truncate">{app.job_title}</p>
                  <div className="flex items-center gap-3 mt-2">
                    {app.location_city && (
                      <span className="text-[10px] text-silver flex items-center gap-1"><MapPin size={9} />{app.location_city}</span>
                    )}
                    {app.next_action_due && (
                      <span className="text-[10px] text-ember font-mono flex items-center gap-1"><Clock size={9} />{app.next_action_due}</span>
                    )}
                  </div>
                  {app.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {app.tags.slice(0, 3).map(t => (
                        <span key={t.id} className="text-[9px] font-mono px-1.5 py-0.5 rounded-full" style={{ backgroundColor: (t.color || '#e4e9f0') + '20', color: t.color || '#8c95a6' }}>
                          {t.name}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        ))}
        {stageApps.length === 0 && (
          <div className="text-center py-16">
            <Target size={32} className="mx-auto text-silver mb-3" />
            <p className="text-steel text-sm">No applications yet</p>
          </div>
        )}
      </div>
    )
  }

  const renderList = () => (
    <div className="overflow-x-auto">
    <div className="min-w-[760px] space-y-2">
      <div className="grid grid-cols-[1fr_1fr_100px_80px_90px_100px_40px] gap-3 px-4 py-2">
        {['Company', 'Position', 'Status', 'Priority', 'Source', 'Applied', ''].map(h => (
          <span key={h} className="font-mono text-[10px] text-steel tracking-wider uppercase">{h}</span>
        ))}
      </div>
      {intApps.map(app => {
        const stageInfo = STATUS_PIPELINE.find(s => s.key === app.current_status)
        return (
          <div key={app.id}>
            <div
              className="grid grid-cols-[1fr_1fr_100px_80px_90px_100px_40px] gap-3 items-center px-4 py-3 bg-white border border-mist rounded-lg cursor-pointer hover:border-blue/30 transition-all"
              onClick={() => setIntEditing(intEditing === app.id ? null : app.id)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Building2 size={13} className="text-steel shrink-0" />
                <span className="text-sm text-ink font-medium truncate">{app.company_name}</span>
              </div>
              <span className="text-sm text-slate truncate">{app.job_title}</span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] px-2 py-1 rounded-full" style={{ backgroundColor: (stageInfo?.color ?? '#999') + '18', color: stageInfo?.color }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stageInfo?.color }} />
                {stageInfo?.label}
              </span>
              <span className={`inline-flex items-center font-mono text-[10px] px-2 py-1 rounded-full border ${PRIORITY_COLORS[app.priority]}`}>
                {app.priority}
              </span>
              <span className="font-mono text-[11px] text-steel capitalize">{app.source?.replace(/_/g, ' ') ?? '—'}</span>
              <span className="font-mono text-[11px] text-steel">{app.applied_on ?? '—'}</span>
              <button
                onClick={e => { e.stopPropagation(); deleteApplication(app.id) }}
                className="p-1.5 text-silver hover:text-ember transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>

            <AnimatePresence>
              {intEditing === app.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-snow border border-t-0 border-mist rounded-b-lg p-5 space-y-4">
                    <div>
                      <label className="block font-mono text-[11px] text-steel mb-2 tracking-wider uppercase">Change Status</label>
                      <div className="flex flex-wrap gap-1.5">
                        {STATUS_PIPELINE.map(s => (
                          <button
                            key={s.key}
                            onClick={() => updateAppStatus(app.id, s.key)}
                            className={`font-mono text-[10px] px-2.5 py-1.5 rounded-full border transition-all ${
                              app.current_status === s.key
                                ? 'border-ink bg-ink text-white'
                                : 'border-mist bg-white text-steel hover:border-blue/30 hover:text-blue'
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                      {app.role_type && (
                        <div>
                          <span className="font-mono text-[10px] text-steel uppercase block mb-1">Role Type</span>
                          <span className="text-ink capitalize">{app.role_type.replace(/_/g, ' ')}</span>
                        </div>
                      )}
                      {app.work_arrangement && (
                        <div>
                          <span className="font-mono text-[10px] text-steel uppercase block mb-1">Arrangement</span>
                          <span className="text-ink capitalize">{app.work_arrangement}</span>
                        </div>
                      )}
                      {app.location_city && (
                        <div>
                          <span className="font-mono text-[10px] text-steel uppercase block mb-1">Location</span>
                          <span className="text-ink flex items-center gap-1"><MapPin size={11} />{app.location_city}</span>
                        </div>
                      )}
                      {app.posting_url && (
                        <div>
                          <span className="font-mono text-[10px] text-steel uppercase block mb-1">Posting</span>
                          <a href={app.posting_url} target="_blank" rel="noopener noreferrer" className="text-blue hover:underline flex items-center gap-1 text-xs"><Link2 size={11} />View</a>
                        </div>
                      )}
                      {app.next_action && (
                        <div>
                          <span className="font-mono text-[10px] text-steel uppercase block mb-1">Next Action</span>
                          <span className="text-ink">{app.next_action}</span>
                        </div>
                      )}
                      {app.next_action_due && (
                        <div>
                          <span className="font-mono text-[10px] text-steel uppercase block mb-1">Due</span>
                          <span className="text-ember font-mono text-xs">{app.next_action_due}</span>
                        </div>
                      )}
                    </div>

                    {app.personal_notes && (
                      <div>
                        <span className="font-mono text-[10px] text-steel uppercase block mb-1">Notes</span>
                        <p className="text-sm text-slate bg-white border border-mist rounded-lg p-3">{app.personal_notes}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      {app.tags.map(t => (
                        <span key={t.id} className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-1 rounded-full" style={{ backgroundColor: (t.color || '#e4e9f0') + '20', color: t.color || '#8c95a6' }}>
                          {t.name}
                          <button onClick={() => api.internships.applications.removeTag(app.id, t.id).then(refreshInternships)} className="hover:text-ember"><X size={9} /></button>
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
      {intApps.length === 0 && (
        <div className="text-center py-16">
          <Target size={32} className="mx-auto text-silver mb-3" />
          <p className="text-steel text-sm">No applications yet. Add your first one!</p>
        </div>
      )}
    </div>
    </div>
  )

  const renderAddForm = () => {
    const form = intForm
    const set = (k: string, v: string) => setIntForm(prev => ({ ...prev, [k]: v }))

    return (
      <SectionCard>
        <h3 className="font-sans font-semibold text-ink mb-6">New Application</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AdminInput label="Company" value={form.company_name} onChange={v => set('company_name', v)} placeholder="e.g. Google" />
          <AdminInput label="Job Title" value={form.job_title} onChange={v => set('job_title', v)} placeholder="e.g. Software Engineer Intern" />
          <AdminInput label="Team" value={form.team} onChange={v => set('team', v)} placeholder="e.g. Search Infra" />
          <AdminSelect label="Role Type" value={form.role_type} onChange={v => set('role_type', v)} options={[
            { value: 'internship', label: 'Internship' }, { value: 'coop', label: 'Co-op' },
            { value: 'new_grad', label: 'New Grad' }, { value: 'full_time', label: 'Full Time' },
            { value: 'contract', label: 'Contract' }, { value: 'part_time', label: 'Part Time' },
          ]} />
          <AdminSelect label="Work Arrangement" value={form.work_arrangement} onChange={v => set('work_arrangement', v)} options={[
            { value: '', label: '— Select —' }, { value: 'onsite', label: 'Onsite' },
            { value: 'hybrid', label: 'Hybrid' }, { value: 'remote', label: 'Remote' },
          ]} />
          <AdminInput label="Location" value={form.location_city} onChange={v => set('location_city', v)} placeholder="e.g. Mountain View, CA" />
          <AdminInput label="Posting URL" value={form.posting_url} onChange={v => set('posting_url', v)} placeholder="https://..." />
          <AdminSelect label="Source" value={form.source} onChange={v => set('source', v)} options={[
            { value: '', label: '— Select —' }, { value: 'linkedin', label: 'LinkedIn' },
            { value: 'indeed', label: 'Indeed' }, { value: 'handshake', label: 'Handshake' },
            { value: 'company_site', label: 'Company Site' }, { value: 'referral', label: 'Referral' },
            { value: 'career_fair', label: 'Career Fair' }, { value: 'recruiter_outreach', label: 'Recruiter Outreach' },
            { value: 'university_portal', label: 'University Portal' }, { value: 'other', label: 'Other' },
          ]} />
          <AdminSelect label="Status" value={form.current_status} onChange={v => set('current_status', v)} options={
            STATUS_PIPELINE.map(s => ({ value: s.key, label: s.label }))
          } />
          <AdminSelect label="Priority" value={form.priority} onChange={v => set('priority', v)} options={[
            { value: 'dream', label: 'Dream' }, { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' },
            { value: 'backup', label: 'Backup' },
          ]} />
          <AdminInput label="Applied On" value={form.applied_on} onChange={v => set('applied_on', v)} type="date" />
          <AdminInput label="Next Action" value={form.next_action} onChange={v => set('next_action', v)} placeholder="e.g. Follow up on application" />
          <AdminInput label="Next Action Due" value={form.next_action_due} onChange={v => set('next_action_due', v)} type="date" />
        </div>
        <div className="mt-4">
          <AdminTextarea label="Notes" value={form.personal_notes} onChange={v => set('personal_notes', v)} rows={3} />
        </div>
        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={() => setIntView('pipeline')}
            className="px-4 py-2.5 bg-cloud text-steel font-mono text-xs rounded-lg hover:bg-mist transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => addApplication(form)}
            disabled={!form.company_name || !form.job_title}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={13} /> Add Application
          </button>
        </div>
      </SectionCard>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-sans font-semibold text-ink mb-1">Internship Tracker</h2>
          <p className="text-steel text-sm">
            {intApps.length} application{intApps.length !== 1 ? 's' : ''} tracked
            {intApps.filter(a => a.current_status === 'offer' || a.current_status === 'accepted').length > 0 &&
              ` — ${intApps.filter(a => a.current_status === 'offer' || a.current_status === 'accepted').length} offer${intApps.filter(a => a.current_status === 'offer' || a.current_status === 'accepted').length !== 1 ? 's' : ''}`
            }
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['dashboard', 'pipeline', 'list'] as const).map(v => (
            <button
              key={v}
              onClick={() => setIntView(v)}
              className={`font-mono text-[11px] px-3.5 py-2 rounded-lg transition-all capitalize ${
                intView === v ? 'bg-blue text-white' : 'bg-white border border-mist text-steel hover:text-blue hover:border-blue/30'
              }`}
            >
              {v === 'dashboard' ? 'Dashboard' : v === 'pipeline' ? 'Pipeline' : 'List'}
            </button>
          ))}
          <button
            onClick={() => setIntView('add')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors shadow-sm sm:ml-2"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      {intView === 'dashboard' && renderIntDashboard()}
      {intView === 'pipeline' && renderPipeline()}
      {intView === 'list' && renderList()}
      {intView === 'add' && renderAddForm()}
    </motion.div>
  )
}
