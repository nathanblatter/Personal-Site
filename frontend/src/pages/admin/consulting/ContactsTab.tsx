import { useState } from 'react'
import { Plus, Search, Mail, Phone, Building2, X, Calendar, MessageSquare, Trash2 } from 'lucide-react'
import { api, type ContactResponse, type ContactDetail } from '../../../lib/api'
import { AdminInput } from '../AdminShared'
import type { CrmShared } from '../ConsultingSection'
import { fmtDate, Pill } from './crmShared'

export default function ContactsTab({ shared }: { shared: CrmShared }) {
  const { contacts, showToast, showError, reloadContacts, reloadDashboard } = shared
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', company_name: '' })
  const [selected, setSelected] = useState<ContactDetail | null>(null)
  const [note, setNote] = useState('')

  const filtered = contacts.filter(c => {
    if (!q.trim()) return true
    const s = q.toLowerCase()
    return c.name.toLowerCase().includes(s) || (c.email || '').toLowerCase().includes(s) || (c.company_name || '').toLowerCase().includes(s)
  })

  const create = async () => {
    if (!form.name.trim()) { showError('Name required'); return }
    try {
      await api.crm.contacts.create({ ...form, source: 'manual' })
      setForm({ name: '', email: '', phone: '', company_name: '' }); setAdding(false)
      await Promise.all([reloadContacts(), reloadDashboard()])
      showToast('Contact added')
    } catch (e) { showError((e as Error).message) }
  }

  const open = async (c: ContactResponse) => {
    try { setSelected(await api.crm.contacts.get(c.id)) }
    catch (e) { showError((e as Error).message) }
  }

  const addNote = async () => {
    if (!selected || !note.trim()) return
    try {
      await api.crm.contacts.addActivity(selected.id, { type: 'note', body_md: note.trim() })
      setNote('')
      setSelected(await api.crm.contacts.get(selected.id))
      showToast('Note added')
    } catch (e) { showError((e as Error).message) }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this contact and all their CRM records?')) return
    try {
      await api.crm.contacts.delete(id)
      setSelected(null)
      await Promise.all([reloadContacts(), reloadDashboard()])
      showToast('Contact deleted')
    } catch (e) { showError((e as Error).message) }
  }

  return (
    <div className="flex gap-5">
      <div className="flex-1 min-w-0 space-y-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-silver" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search contacts…"
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-mist rounded-lg text-sm focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10" />
          </div>
          <button onClick={() => setAdding(a => !a)} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue text-white rounded-lg text-sm font-medium hover:bg-blue/90 shrink-0">
            <Plus size={15} /> Add
          </button>
        </div>

        {adding && (
          <div className="bg-snow border border-mist rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <AdminInput label="Name" value={form.name} onChange={v => setForm({ ...form, name: v })} />
            <AdminInput label="Email" value={form.email} onChange={v => setForm({ ...form, email: v })} />
            <AdminInput label="Phone" value={form.phone} onChange={v => setForm({ ...form, phone: v })} />
            <AdminInput label="Company" value={form.company_name} onChange={v => setForm({ ...form, company_name: v })} />
            <button onClick={create} className="col-span-2 px-4 py-2.5 bg-blue text-white rounded-lg text-sm font-medium hover:bg-blue/90">Create contact</button>
          </div>
        )}

        <div className="bg-snow border border-mist rounded-xl divide-y divide-mist overflow-hidden">
          {filtered.map(c => (
            <button key={c.id} onClick={() => open(c)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-cloud transition-colors ${selected?.id === c.id ? 'bg-blue-wash' : ''}`}>
              <div className="w-8 h-8 rounded-full bg-blue/10 text-blue flex items-center justify-center font-mono text-xs shrink-0">
                {c.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink truncate">{c.name}</div>
                <div className="text-xs text-steel truncate">{c.email || c.company_name || '—'}</div>
              </div>
              {c.source && <span className="font-mono text-[9px] text-silver uppercase shrink-0">{c.source.replace('_', ' ')}</span>}
            </button>
          ))}
          {filtered.length === 0 && <div className="text-center text-sm text-silver py-8">No contacts</div>}
        </div>
      </div>

      {selected && (
        <div className="w-[360px] shrink-0 bg-snow border border-mist rounded-xl p-5 self-start sticky top-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-lg font-semibold text-ink">{selected.name}</h3>
              {selected.title && <div className="text-xs text-steel">{selected.title}</div>}
            </div>
            <button onClick={() => setSelected(null)} className="text-silver hover:text-ink"><X size={16} /></button>
          </div>

          <div className="space-y-1.5 mb-4 text-sm">
            {selected.email && <div className="flex items-center gap-2 text-steel"><Mail size={13} /> {selected.email}</div>}
            {selected.phone && <div className="flex items-center gap-2 text-steel"><Phone size={13} /> {selected.phone}</div>}
            {(selected.company_name || selected.organization?.name) && (
              <div className="flex items-center gap-2 text-steel"><Building2 size={13} /> {selected.organization?.name || selected.company_name}</div>
            )}
          </div>

          {(selected.deals.length > 0 || selected.engagements.length > 0) && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {selected.deals.map(d => <span key={d.id} className="inline-flex items-center gap-1"><Pill label={d.stage} kind="stage" /></span>)}
              {selected.engagements.map(e => <Pill key={e.id} label={e.status} kind="engagement" />)}
            </div>
          )}

          {selected.bookings.length > 0 && (
            <div className="mb-4">
              <div className="font-mono text-[10px] text-steel uppercase tracking-wider mb-1.5">Bookings</div>
              {selected.bookings.map(b => (
                <div key={b.id} className="flex items-center gap-2 text-xs text-steel py-0.5">
                  <Calendar size={12} /> {b.topic} · {fmtDate(b.start_at)}
                </div>
              ))}
            </div>
          )}

          <div className="font-mono text-[10px] text-steel uppercase tracking-wider mb-2">Timeline</div>
          <div className="flex gap-2 mb-3">
            <input value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote()}
              placeholder="Add a note…" className="flex-1 px-3 py-2 bg-white border border-mist rounded-lg text-xs focus:outline-none focus:border-blue/50" />
            <button onClick={addNote} className="px-3 py-2 bg-cloud text-steel rounded-lg hover:bg-blue-wash hover:text-blue text-xs">Add</button>
          </div>
          <div className="space-y-2 max-h-[280px] overflow-y-auto">
            {selected.activities.map(a => (
              <div key={a.id} className="flex gap-2 text-xs">
                <MessageSquare size={12} className="text-silver shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-ink break-words">{a.body_md || a.type}</div>
                  <div className="text-silver font-mono text-[10px]">{a.type} · {fmtDate(a.occurred_at)}</div>
                </div>
              </div>
            ))}
            {selected.activities.length === 0 && <div className="text-xs text-silver">No activity yet</div>}
          </div>

          <button onClick={() => remove(selected.id)} className="mt-4 inline-flex items-center gap-1.5 text-xs text-steel hover:text-ember">
            <Trash2 size={12} /> Delete contact
          </button>
        </div>
      )}
    </div>
  )
}
