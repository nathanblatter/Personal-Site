import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Plus, Trash2, Check, Ban, Video, Copy, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  api,
  type BookingResponse,
  type AvailabilityWindowResponse,
  type DateOverrideResponse,
  type BookingSettingsResponse,
} from '../../lib/api'
import { AdminInput, AdminTextarea, AdminSelect, SectionCard, type AdminCallbacks } from './AdminShared'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const COMMON_TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney', 'UTC',
]

export default function BookingsSection({ showToast, showError }: AdminCallbacks) {
  const [bkBookings, setBkBookings] = useState<BookingResponse[]>([])
  const [bkWindows, setBkWindows] = useState<AvailabilityWindowResponse[]>([])
  const [bkBlocked, setBkBlocked] = useState<DateOverrideResponse[]>([])
  const [bkSettings, setBkSettings] = useState<BookingSettingsResponse | null>(null)
  const [bkTab, setBkTab] = useState<'pending' | 'upcoming' | 'past' | 'settings'>('pending')
  const [bkDeclineNote, setBkDeclineNote] = useState<Record<number, string>>({})
  const [bkShowDecline, setBkShowDecline] = useState<number | null>(null)
  const [bkShowBlockPicker, setBkShowBlockPicker] = useState(false)
  const [bkBlockMonth, setBkBlockMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
  const [bkBlockReason, setBkBlockReason] = useState('')
  const [bkConfirmAction, setBkConfirmAction] = useState<{ type: 'accept' | 'decline' | 'cancel'; id: number } | null>(null)
  const [bkPastSort, setBkPastSort] = useState<'date' | 'name' | 'status'>('date')
  const [bkPastFilter, setBkPastFilter] = useState<string>('all')
  const [bkCopied, setBkCopied] = useState<number | null>(null)
  const [bkShowScheduler, setBkShowScheduler] = useState(false)
  const [bkScheduleForm, setBkScheduleForm] = useState({ name: '', email: '', topic: '', date: '', time: '', duration: 30 })
  const [bkScheduleLoading, setBkScheduleLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      api.bookings.list(),
      api.bookings.availability.list(),
      api.bookings.blockedDates.list(),
      api.bookings.settings.get(),
    ]).then(([bookings, windows, blocked, settings]) => {
      setBkBookings(bookings); setBkWindows(windows); setBkBlocked(blocked); setBkSettings(settings)
    }).catch(err => showError((err as Error).message))
  }, [showError])

  const refreshBookings = async () => {
    try {
      const [bookings, windows, blocked, settings] = await Promise.all([
        api.bookings.list(),
        api.bookings.availability.list(),
        api.bookings.blockedDates.list(),
        api.bookings.settings.get(),
      ])
      setBkBookings(bookings); setBkWindows(windows); setBkBlocked(blocked); setBkSettings(settings)
    } catch (err) { showError((err as Error).message) }
  }

  const handleBkAccept = async (id: number) => {
    try {
      const updated = await api.bookings.accept(id)
      setBkBookings(bkBookings.map(b => b.id === id ? updated : b))
      showToast('Booking accepted')
      setBkConfirmAction(null)
    } catch (err) { showError((err as Error).message) }
  }

  const handleBkDecline = async (id: number) => {
    try {
      await api.bookings.decline(id, { admin_note: bkDeclineNote[id] || undefined })
      showToast('Booking declined')
      setBkShowDecline(null)
      setBkConfirmAction(null)
      refreshBookings()
    } catch (err) { showError((err as Error).message) }
  }

  const handleBkDelete = async (id: number) => {
    try {
      await api.bookings.delete(id)
      setBkBookings(bkBookings.filter(b => b.id !== id))
      showToast('Booking cancelled')
      setBkConfirmAction(null)
    } catch (err) { showError((err as Error).message) }
  }

  const pendingBookings = bkBookings.filter(b => b.status === 'pending')
  const upcomingBookings = bkBookings.filter(b => b.status === 'confirmed' && new Date(b.start_at) > new Date())
  const pastBookings = bkBookings.filter(b => b.status !== 'pending' && (b.status !== 'confirmed' || new Date(b.start_at) <= new Date()))

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-sans font-semibold text-ink mb-1">Bookings</h2>
          <p className="text-steel text-sm">
            {pendingBookings.length} pending · {upcomingBookings.length} upcoming
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBkShowScheduler(!bkShowScheduler)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-mono text-blue bg-blue-wash rounded-lg hover:bg-blue/10 transition-colors"
          >
            <Plus size={12} /> Schedule
          </button>
          {(['pending', 'upcoming', 'past', 'settings'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setBkTab(tab)}
              className={`font-mono text-[11px] px-3.5 py-2 rounded-lg transition-all capitalize ${
                bkTab === tab ? 'bg-blue text-white' : 'bg-white border border-mist text-steel hover:text-blue hover:border-blue/30'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {bkShowScheduler && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <SectionCard>
              <h3 className="font-sans font-semibold text-ink mb-4">Schedule a Call</h3>
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!bkScheduleForm.name || !bkScheduleForm.email || !bkScheduleForm.topic) { showError('Name, email, and topic required'); return }
                  if (!bkScheduleForm.date || !bkScheduleForm.time) { showError('Date and time required'); return }
                  setBkScheduleLoading(true)
                  try {
                    const startAt = new Date(`${bkScheduleForm.date}T${bkScheduleForm.time}`).toISOString()
                    const booking = await api.bookings.adminCreate({
                      visitor_name: bkScheduleForm.name,
                      visitor_email: bkScheduleForm.email,
                      topic: bkScheduleForm.topic,
                      start_at: startAt,
                      duration_minutes: bkScheduleForm.duration,
                    })
                    setBkBookings([booking, ...bkBookings])
                    setBkScheduleForm({ name: '', email: '', topic: '', date: '', time: '', duration: 30 })
                    setBkShowScheduler(false)
                    showToast('Call scheduled & confirmation sent')
                  } catch (err) { showError((err as Error).message) }
                  finally { setBkScheduleLoading(false) }
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <AdminInput label="Name" value={bkScheduleForm.name} onChange={v => setBkScheduleForm({ ...bkScheduleForm, name: v })} />
                  <AdminInput label="Email" value={bkScheduleForm.email} onChange={v => setBkScheduleForm({ ...bkScheduleForm, email: v })} />
                </div>
                <AdminInput label="Topic" value={bkScheduleForm.topic} onChange={v => setBkScheduleForm({ ...bkScheduleForm, topic: v })} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-mono text-[11px] text-steel mb-1.5 tracking-wider uppercase">Date</label>
                    <input
                      type="date"
                      required
                      value={bkScheduleForm.date}
                      onChange={e => setBkScheduleForm({ ...bkScheduleForm, date: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white border border-mist rounded-xl text-sm text-ink font-mono focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[11px] text-steel mb-1.5 tracking-wider uppercase">Time</label>
                    <input
                      type="time"
                      required
                      value={bkScheduleForm.time}
                      onChange={e => setBkScheduleForm({ ...bkScheduleForm, time: e.target.value })}
                      className="w-full px-3 py-2.5 bg-white border border-mist rounded-xl text-sm text-ink font-mono focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[11px] text-steel mb-1.5 tracking-wider uppercase">Duration</label>
                    <select
                      value={bkScheduleForm.duration}
                      onChange={e => setBkScheduleForm({ ...bkScheduleForm, duration: Number(e.target.value) })}
                      className="w-full px-3 py-2.5 bg-white border border-mist rounded-xl text-sm text-ink font-mono focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all"
                    >
                      <option value={15}>15 min</option>
                      <option value={30}>30 min</option>
                      <option value={45}>45 min</option>
                      <option value={60}>60 min</option>
                    </select>
                  </div>
                </div>
                <p className="font-mono text-[10px] text-silver">Bypasses availability windows. Creates a confirmed booking and sends the invite immediately.</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setBkShowScheduler(false)}
                    className="px-4 py-2.5 border border-mist text-steel font-mono text-xs rounded-lg hover:bg-cloud transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={bkScheduleLoading}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors disabled:opacity-60"
                  >
                    {bkScheduleLoading ? 'Scheduling...' : 'Schedule & Send Invite'}
                  </button>
                </div>
              </form>
            </SectionCard>
          </motion.div>
        )}
      </AnimatePresence>

      {bkTab === 'pending' && (
        <div className="space-y-3">
          {pendingBookings.length === 0 ? (
            <p className="text-steel text-sm text-center py-12">No pending booking requests.</p>
          ) : pendingBookings.map(b => (
            <SectionCard key={b.id}>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h4 className="font-semibold text-ink">{b.visitor_name}</h4>
                  <p className="font-mono text-xs text-steel">{b.visitor_email}</p>
                  <p className="text-sm text-ink mt-2">{b.topic}</p>
                  <p className="font-mono text-xs text-steel mt-1">
                    {new Date(b.start_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    {' · '}{b.duration_minutes} min
                  </p>
                  <p className="font-mono text-[10px] text-silver mt-1">
                    Requested {new Date(b.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-col gap-2 shrink-0 ml-4">
                  <button
                    onClick={() => setBkConfirmAction({ type: 'accept', id: b.id })}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal text-white font-mono text-xs font-semibold rounded-lg hover:bg-teal/90 transition-colors"
                  >
                    <Check size={13} /> Accept
                  </button>
                  <button
                    onClick={() => setBkShowDecline(bkShowDecline === b.id ? null : b.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 border border-mist text-steel font-mono text-xs rounded-lg hover:text-ember hover:border-ember/30 transition-colors"
                  >
                    <Ban size={13} /> Decline
                  </button>
                </div>
              </div>
              <AnimatePresence>
                {bkShowDecline === b.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="mt-4 pt-4 border-t border-mist space-y-3">
                      <AdminTextarea
                        label="Decline note (optional)"
                        value={bkDeclineNote[b.id] || ''}
                        onChange={v => setBkDeclineNote({ ...bkDeclineNote, [b.id]: v })}
                        rows={2}
                      />
                      <button
                        onClick={() => handleBkDecline(b.id)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-ember text-white font-mono text-xs font-semibold rounded-lg hover:bg-ember/90 transition-colors"
                      >
                        Confirm Decline
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </SectionCard>
          ))}
        </div>
      )}

      {bkTab === 'upcoming' && (
        <div className="space-y-3">
          {upcomingBookings.length === 0 ? (
            <p className="text-steel text-sm text-center py-12">No upcoming calls.</p>
          ) : upcomingBookings.map(b => (
            <SectionCard key={b.id}>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h4 className="font-semibold text-ink">{b.visitor_name}</h4>
                  <p className="text-sm text-ink">{b.topic}</p>
                  <p className="font-mono text-xs text-steel">
                    {new Date(b.start_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    {' · '}{b.duration_minutes} min
                  </p>
                  {b.zoom_join_url && (
                    <div className="flex items-center gap-2 mt-2">
                      <a href={b.zoom_join_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-blue font-mono text-xs hover:underline">
                        <Video size={13} /> Join Zoom
                      </a>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(b.zoom_join_url!)
                          setBkCopied(b.id)
                          setTimeout(() => setBkCopied(null), 2000)
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 text-steel hover:text-blue font-mono text-[10px] bg-cloud rounded-md transition-colors"
                      >
                        {bkCopied === b.id ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy link</>}
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setBkConfirmAction({ type: 'cancel', id: b.id })}
                  className="p-2 text-steel hover:text-ember transition-colors"
                  title="Cancel booking"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      {bkTab === 'past' && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-silver">Sort:</span>
              {(['date', 'name', 'status'] as const).map(s => (
                <button key={s} onClick={() => setBkPastSort(s)} className={`font-mono text-[10px] px-2 py-1 rounded transition-all capitalize ${bkPastSort === s ? 'bg-blue text-white' : 'text-steel hover:text-ink'}`}>{s}</button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-silver">Filter:</span>
              {['all', 'confirmed', 'declined', 'cancelled'].map(f => (
                <button key={f} onClick={() => setBkPastFilter(f)} className={`font-mono text-[10px] px-2 py-1 rounded transition-all capitalize ${bkPastFilter === f ? 'bg-blue text-white' : 'text-steel hover:text-ink'}`}>{f}</button>
              ))}
            </div>
          </div>
          {(() => {
            let filtered = pastBookings.filter(b => bkPastFilter === 'all' || b.status === bkPastFilter)
            if (bkPastSort === 'date') filtered = [...filtered].sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime())
            else if (bkPastSort === 'name') filtered = [...filtered].sort((a, b) => a.visitor_name.localeCompare(b.visitor_name))
            else if (bkPastSort === 'status') filtered = [...filtered].sort((a, b) => a.status.localeCompare(b.status))
            return filtered.length === 0 ? (
              <p className="text-steel text-sm text-center py-12">No past bookings{bkPastFilter !== 'all' ? ` with status "${bkPastFilter}"` : ''}.</p>
            ) : filtered.map(b => (
              <SectionCard key={b.id}>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium text-ink">{b.visitor_name} — {b.topic}</h4>
                    <p className="font-mono text-xs text-steel">
                      {new Date(b.start_at).toLocaleDateString()} · {b.duration_minutes} min ·{' '}
                      <span className={b.status === 'confirmed' ? 'text-teal' : b.status === 'declined' ? 'text-ember' : 'text-steel'}>
                        {b.status}
                      </span>
                    </p>
                    {b.admin_note && <p className="text-xs text-steel italic mt-1">{b.admin_note}</p>}
                  </div>
                </div>
              </SectionCard>
            ))
          })()}
        </div>
      )}

      {bkTab === 'settings' && bkSettings && (
        <div className="space-y-8">
          {/* Global settings */}
          <SectionCard>
            <h3 className="font-sans font-semibold text-ink mb-5">Global Settings</h3>
            <div className="space-y-5">
              <AdminSelect
                label="Timezone"
                value={bkSettings.timezone}
                onChange={async v => {
                  try {
                    const updated = await api.bookings.settings.update({ timezone: v })
                    setBkSettings(updated)
                    showToast('Timezone updated')
                  } catch (err) { showError((err as Error).message) }
                }}
                options={COMMON_TIMEZONES.map(tz => ({ value: tz, label: tz }))}
              />
              <div>
                <label className="block font-mono text-[11px] text-steel mb-1.5 tracking-wider uppercase">Booking Enabled</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bkSettings.enabled}
                    onChange={async e => {
                      try {
                        const updated = await api.bookings.settings.update({ enabled: e.target.checked })
                        setBkSettings(updated)
                        showToast(e.target.checked ? 'Booking enabled' : 'Booking disabled')
                      } catch (err) { showError((err as Error).message) }
                    }}
                    className="rounded"
                  />
                  <span className="text-sm text-ink">{bkSettings.enabled ? 'Enabled' : 'Disabled'}</span>
                </label>
              </div>
            </div>
          </SectionCard>

          {/* Availability windows */}
          <SectionCard>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-sans font-semibold text-ink">Availability Windows</h3>
              <button
                onClick={async () => {
                  try {
                    const w = await api.bookings.availability.create({ day_of_week: 1, start_time: '09:00', end_time: '17:00', allowed_durations: [30], enabled: true })
                    setBkWindows([...bkWindows, w])
                    showToast('Window added')
                  } catch (err) { showError((err as Error).message) }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-blue bg-blue-wash rounded-lg hover:bg-blue/10 transition-colors"
              >
                <Plus size={12} /> Add
              </button>
            </div>
            <div className="space-y-4">
              {bkWindows.map(w => (
                <div key={w.id} className="flex items-center gap-3 p-4 bg-cloud rounded-xl">
                  <select
                    value={w.day_of_week}
                    onChange={async e => {
                      try {
                        const updated = await api.bookings.availability.update(w.id, { day_of_week: Number(e.target.value) })
                        setBkWindows(bkWindows.map(x => x.id === w.id ? updated : x))
                      } catch (err) { showError((err as Error).message) }
                    }}
                    className="px-2 py-1.5 bg-white border border-mist rounded-lg text-sm text-ink font-mono"
                  >
                    {DAY_LABELS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                  <input
                    type="time"
                    value={w.start_time}
                    onChange={async e => {
                      try {
                        const updated = await api.bookings.availability.update(w.id, { start_time: e.target.value })
                        setBkWindows(bkWindows.map(x => x.id === w.id ? updated : x))
                      } catch (err) { showError((err as Error).message) }
                    }}
                    className="px-2 py-1.5 bg-white border border-mist rounded-lg text-sm text-ink font-mono"
                  />
                  <span className="text-steel text-xs">to</span>
                  <input
                    type="time"
                    value={w.end_time}
                    onChange={async e => {
                      try {
                        const updated = await api.bookings.availability.update(w.id, { end_time: e.target.value })
                        setBkWindows(bkWindows.map(x => x.id === w.id ? updated : x))
                      } catch (err) { showError((err as Error).message) }
                    }}
                    className="px-2 py-1.5 bg-white border border-mist rounded-lg text-sm text-ink font-mono"
                  />
                  <div className="flex items-center gap-2 ml-2">
                    {[15, 30].map(dur => (
                      <label key={dur} className="flex items-center gap-1 text-xs font-mono text-steel cursor-pointer">
                        <input
                          type="checkbox"
                          checked={w.allowed_durations.includes(dur)}
                          onChange={async e => {
                            const newDurs = e.target.checked
                              ? [...w.allowed_durations, dur].sort((a, b) => a - b)
                              : w.allowed_durations.filter(d => d !== dur)
                            if (newDurs.length === 0) return
                            try {
                              const updated = await api.bookings.availability.update(w.id, { allowed_durations: newDurs })
                              setBkWindows(bkWindows.map(x => x.id === w.id ? updated : x))
                            } catch (err) { showError((err as Error).message) }
                          }}
                          className="rounded"
                        />
                        {dur}m
                      </label>
                    ))}
                  </div>
                  <label className="flex items-center gap-1 text-xs font-mono text-steel ml-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={w.enabled}
                      onChange={async e => {
                        try {
                          const updated = await api.bookings.availability.update(w.id, { enabled: e.target.checked })
                          setBkWindows(bkWindows.map(x => x.id === w.id ? updated : x))
                        } catch (err) { showError((err as Error).message) }
                      }}
                      className="rounded"
                    />
                    On
                  </label>
                  <button
                    onClick={async () => {
                      try {
                        await api.bookings.availability.delete(w.id)
                        setBkWindows(bkWindows.filter(x => x.id !== w.id))
                        showToast('Window deleted')
                      } catch (err) { showError((err as Error).message) }
                    }}
                    className="p-1.5 text-steel hover:text-ember transition-colors ml-auto"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {bkWindows.length === 0 && (
                <p className="text-steel text-sm text-center py-4">No availability windows configured.</p>
              )}
            </div>
          </SectionCard>

          {/* Blocked dates */}
          <SectionCard>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-sans font-semibold text-ink">Blocked Dates</h3>
              <button
                onClick={() => setBkShowBlockPicker(!bkShowBlockPicker)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-blue bg-blue-wash rounded-lg hover:bg-blue/10 transition-colors"
              >
                <Plus size={12} /> Block Date
              </button>
            </div>

            <AnimatePresence>
              {bkShowBlockPicker && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-5">
                  <div className="p-4 bg-cloud rounded-xl border border-mist space-y-4">
                    {/* Month navigation */}
                    <div className="flex items-center justify-between">
                      <button onClick={() => setBkBlockMonth(new Date(bkBlockMonth.getFullYear(), bkBlockMonth.getMonth() - 1, 1))} className="p-1.5 rounded-lg text-steel hover:text-ink hover:bg-white transition-colors"><ChevronLeft size={16} /></button>
                      <span className="font-mono text-sm text-ink font-medium">
                        {bkBlockMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                      </span>
                      <button onClick={() => setBkBlockMonth(new Date(bkBlockMonth.getFullYear(), bkBlockMonth.getMonth() + 1, 1))} className="p-1.5 rounded-lg text-steel hover:text-ink hover:bg-white transition-colors"><ChevronRight size={16} /></button>
                    </div>
                    {/* Day headers */}
                    <div className="grid grid-cols-7 gap-1 text-center">
                      {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d => (
                        <span key={d} className="font-mono text-[10px] text-silver py-1">{d}</span>
                      ))}
                    </div>
                    {/* Calendar grid */}
                    <div className="grid grid-cols-7 gap-1">
                      {(() => {
                        const year = bkBlockMonth.getFullYear()
                        const month = bkBlockMonth.getMonth()
                        const firstDay = new Date(year, month, 1)
                        const lastDay = new Date(year, month + 1, 0)
                        const startPad = (firstDay.getDay() + 6) % 7 // Mon=0
                        const cells: React.ReactNode[] = []
                        for (let i = 0; i < startPad; i++) cells.push(<div key={`pad-${i}`} />)
                        for (let d = 1; d <= lastDay.getDate(); d++) {
                          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                          const isBlocked = bkBlocked.some(b => b.date === dateStr)
                          const isPast = new Date(year, month, d) < new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())
                          cells.push(
                            <button
                              key={d}
                              disabled={isPast}
                              onClick={async () => {
                                if (isBlocked) {
                                  const blocked = bkBlocked.find(b => b.date === dateStr)
                                  if (!blocked) return
                                  try {
                                    await api.bookings.blockedDates.delete(blocked.id)
                                    setBkBlocked(bkBlocked.filter(x => x.id !== blocked.id))
                                    showToast(`${dateStr} unblocked`)
                                  } catch (err) { showError((err as Error).message) }
                                  return
                                }
                                try {
                                  const created = await api.bookings.blockedDates.create({ date: dateStr, reason: bkBlockReason || undefined })
                                  setBkBlocked([...bkBlocked, created])
                                  showToast(`${dateStr} blocked`)
                                } catch (err) { showError((err as Error).message) }
                              }}
                              className={`aspect-square rounded-lg text-xs font-mono flex items-center justify-center transition-all ${
                                isBlocked
                                  ? 'bg-ember/10 text-ember font-semibold border border-ember/20'
                                  : isPast
                                  ? 'text-silver/40 cursor-not-allowed'
                                  : 'text-ink hover:bg-blue-wash hover:text-blue cursor-pointer'
                              }`}
                            >
                              {d}
                            </button>
                          )
                        }
                        return cells
                      })()}
                    </div>
                    {/* Reason input */}
                    <div>
                      <label className="block font-mono text-[10px] text-steel mb-1 tracking-wider uppercase">Reason (optional)</label>
                      <input
                        type="text"
                        value={bkBlockReason}
                        onChange={e => setBkBlockReason(e.target.value)}
                        placeholder="e.g. Vacation, Holiday"
                        className="w-full px-3 py-2 bg-white border border-mist rounded-lg text-sm text-ink placeholder-silver focus:outline-none focus:border-blue/50 transition-colors"
                      />
                    </div>
                    <p className="font-mono text-[10px] text-silver">Click to block/unblock dates. Blocked dates shown in red.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              {bkBlocked.map(d => (
                <div key={d.id} className="flex items-center justify-between p-3 bg-cloud rounded-lg">
                  <div>
                    <span className="font-mono text-sm text-ink">{d.date}</span>
                    {d.reason && <span className="text-xs text-steel ml-3">{d.reason}</span>}
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await api.bookings.blockedDates.delete(d.id)
                        setBkBlocked(bkBlocked.filter(x => x.id !== d.id))
                        showToast('Date unblocked')
                      } catch (err) { showError((err as Error).message) }
                    }}
                    className="p-1.5 text-steel hover:text-ember transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {bkBlocked.length === 0 && (
                <p className="text-steel text-sm text-center py-4">No dates blocked.</p>
              )}
            </div>
          </SectionCard>
        </div>
      )}

      {/* Confirmation dialog */}
      <AnimatePresence>
        {bkConfirmAction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40"
            onClick={() => setBkConfirmAction(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="font-sans font-semibold text-ink text-lg mb-2 capitalize">
                {bkConfirmAction.type} booking?
              </h3>
              <p className="text-steel text-sm mb-6">
                {bkConfirmAction.type === 'accept' && 'This will create a Zoom meeting and send confirmation emails to both parties.'}
                {bkConfirmAction.type === 'decline' && 'This will notify the visitor that their request has been declined.'}
                {bkConfirmAction.type === 'cancel' && 'This will cancel the booking, delete any Zoom meeting, and notify the visitor.'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setBkConfirmAction(null)}
                  className="flex-1 px-4 py-2.5 border border-mist text-steel font-mono text-xs rounded-lg hover:bg-cloud transition-colors"
                >
                  Nevermind
                </button>
                <button
                  onClick={() => {
                    if (bkConfirmAction.type === 'accept') handleBkAccept(bkConfirmAction.id)
                    else if (bkConfirmAction.type === 'decline') handleBkDecline(bkConfirmAction.id)
                    else handleBkDelete(bkConfirmAction.id)
                  }}
                  className={`flex-1 px-4 py-2.5 text-white font-mono text-xs font-semibold rounded-lg transition-colors ${
                    bkConfirmAction.type === 'accept' ? 'bg-teal hover:bg-teal/90' : 'bg-ember hover:bg-ember/90'
                  }`}
                >
                  {bkConfirmAction.type === 'accept' ? 'Accept' : bkConfirmAction.type === 'decline' ? 'Decline' : 'Cancel Booking'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
