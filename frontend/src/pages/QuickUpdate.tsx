import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  api,
  type QuickUpdateContext,
  type QuickUpdateSave,
  type NowContent,
  type UsesContent,
  type QuickAvailabilityWindow,
} from '../lib/api'
import Skeleton from '../components/Skeleton'

type PageState = 'loading' | 'form' | 'saving' | 'done' | 'notfound' | 'error'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// ── Editable local shapes ────────────────────────────────────────────────────

interface NowSectionEdit { icon: string; title: string; items: string }        // items: one per line
interface UsesCategoryEdit { icon: string; title: string; items: string }       // items: "Name — note" per line
interface DayEdit {
  enabled: boolean
  start_time: string
  end_time: string
  durations: number[]
}

function nowToEdit(n?: NowContent): NowSectionEdit[] {
  return (n?.sections ?? []).map(s => ({
    icon: s.icon || '',
    title: s.title || '',
    items: (s.items ?? []).join('\n'),
  }))
}

function usesToEdit(u?: UsesContent): UsesCategoryEdit[] {
  return (u?.categories ?? []).map(c => ({
    icon: c.icon || '',
    title: c.title || '',
    items: (c.items ?? []).map(i => (i.note ? `${i.name} — ${i.note}` : i.name)).join('\n'),
  }))
}

function editToNow(sections: NowSectionEdit[], lastUpdated: string): NowContent {
  return {
    last_updated: lastUpdated,
    sections: sections
      .filter(s => s.title.trim() || s.items.trim())
      .map(s => ({
        icon: s.icon.trim() || 'Circle',
        title: s.title.trim(),
        items: s.items.split('\n').map(l => l.trim()).filter(Boolean),
      })),
  }
}

function editToUses(cats: UsesCategoryEdit[]): UsesContent {
  return {
    categories: cats
      .filter(c => c.title.trim() || c.items.trim())
      .map(c => ({
        icon: c.icon.trim() || 'Circle',
        title: c.title.trim(),
        items: c.items.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
          const parts = line.split(/\s+[—|-]\s+/)  // "Name — note" / "Name | note" / "Name - note"
          return { name: (parts[0] ?? line).trim(), note: (parts[1] ?? '').trim() }
        }),
      })),
  }
}

function windowsToDays(windows?: QuickAvailabilityWindow[]): DayEdit[] {
  return DAYS.map((_, dow) => {
    const w = (windows ?? []).find(x => x.day_of_week === dow)
    return w
      ? { enabled: w.enabled, start_time: w.start_time, end_time: w.end_time, durations: w.allowed_durations?.length ? w.allowed_durations : [30] }
      : { enabled: false, start_time: '14:00', end_time: '17:00', durations: [30] }
  })
}

function daysToWindows(days: DayEdit[]): QuickAvailabilityWindow[] {
  return days
    .map((d, dow) => ({
      day_of_week: dow,
      start_time: d.start_time,
      end_time: d.end_time,
      allowed_durations: d.durations.length ? [...d.durations].sort((a, b) => a - b) : [30],
      enabled: d.enabled,
    }))
    // Only persist days he actually turned on — an off day just has no window.
    .filter(d => d.enabled)
}

// ── Small styled primitives ──────────────────────────────────────────────────

const inputCls =
  'w-full rounded-lg border border-mist bg-white px-3 py-2 text-sm text-ink placeholder:text-silver focus:border-blue focus:outline-none'

function FormSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-mist bg-white p-5 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-20 w-full" />
        </div>
      ))}
    </div>
  )
}

export default function QuickUpdate() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<PageState>('loading')
  const [ctx, setCtx] = useState<QuickUpdateContext | null>(null)
  const [error, setError] = useState<string | null>(null)

  // monthly_update state
  const [nowSections, setNowSections] = useState<NowSectionEdit[]>([])
  const [usesCats, setUsesCats] = useState<UsesCategoryEdit[]>([])
  const [lastUpdated, setLastUpdated] = useState('')

  // availability state
  const [days, setDays] = useState<DayEdit[]>([])
  const [bookingEnabled, setBookingEnabled] = useState(true)

  useEffect(() => {
    if (!token) return
    api.quickUpdate.get(token)
      .then(data => {
        setCtx(data)
        if (data.purpose === 'monthly_update') {
          setNowSections(nowToEdit(data.now))
          setUsesCats(usesToEdit(data.uses))
          setLastUpdated(
            new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
          )
        } else {
          setDays(windowsToDays(data.windows))
          setBookingEnabled(data.booking_enabled ?? true)
        }
        setState('form')
      })
      .catch((e: Error) => {
        setState(e.message.includes('404') ? 'notfound' : 'error')
      })
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token || !ctx) return
    setState('saving')
    setError(null)
    const payload: QuickUpdateSave =
      ctx.purpose === 'monthly_update'
        ? { now: editToNow(nowSections, lastUpdated), uses: editToUses(usesCats) }
        : { windows: daysToWindows(days), booking_enabled: bookingEnabled }
    try {
      await api.quickUpdate.save(token, payload)
      setState('done')
    } catch {
      setError('Could not save. Please try again.')
      setState('form')
    }
  }

  return (
    <div className="min-h-screen bg-cloud py-10 px-4">
      <div className="max-w-[640px] mx-auto">
        <header className="mb-8">
          <span className="font-mono text-xs text-blue tracking-[0.2em] uppercase">// QUICK UPDATE</span>
          <h1 className="font-serif text-3xl italic text-ink mt-2">
            {ctx?.purpose === 'availability' ? 'Booking availability' : "What's new"}
          </h1>
          <p className="text-steel text-sm mt-2">
            {ctx?.purpose === 'availability'
              ? 'Set the times you can take calls this week. Off days just stay empty.'
              : 'Keep, tweak, or add to your /now and /uses pages. Prefilled with what’s live now.'}
          </p>
        </header>

        {state === 'loading' && <FormSkeleton />}

        {state === 'notfound' && (
          <div className="rounded-2xl border border-mist bg-white p-8 text-center">
            <h2 className="font-sans font-semibold text-ink text-lg mb-1">Link expired</h2>
            <p className="text-steel text-sm">This link is no longer valid. A fresh one will arrive with the next refresh.</p>
          </div>
        )}

        {state === 'error' && (
          <div className="rounded-2xl border border-mist bg-white p-8 text-center">
            <h2 className="font-sans font-semibold text-ink text-lg mb-1">Something went wrong</h2>
            <p className="text-steel text-sm">Couldn’t load the form. Try reopening the link.</p>
          </div>
        )}

        {state === 'done' && (
          <div className="rounded-2xl border border-mist bg-white p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-blue/10 text-blue text-2xl flex items-center justify-center mx-auto mb-4">✓</div>
            <h2 className="font-sans font-semibold text-ink text-lg mb-1">Saved</h2>
            <p className="text-steel text-sm">Your changes are live. You can close this — or reopen the link anytime before it expires to make more edits.</p>
          </div>
        )}

        {(state === 'form' || state === 'saving') && ctx && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {ctx.purpose === 'monthly_update' ? (
              <>
                {/* NOW */}
                <section>
                  <h2 className="font-sans font-semibold text-ink text-base mb-3">/now — what you’re doing</h2>
                  <div className="space-y-4">
                    {nowSections.map((s, i) => (
                      <div key={i} className="rounded-2xl border border-mist bg-white p-4 space-y-2">
                        <div className="flex gap-2">
                          <input
                            className={inputCls + ' max-w-[120px]'}
                            placeholder="Icon"
                            value={s.icon}
                            onChange={e => setNowSections(p => p.map((x, j) => j === i ? { ...x, icon: e.target.value } : x))}
                          />
                          <input
                            className={inputCls}
                            placeholder="Section title (e.g. Building)"
                            value={s.title}
                            onChange={e => setNowSections(p => p.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                          />
                        </div>
                        <textarea
                          className={inputCls + ' min-h-[80px] resize-y'}
                          placeholder="One item per line"
                          value={s.items}
                          onChange={e => setNowSections(p => p.map((x, j) => j === i ? { ...x, items: e.target.value } : x))}
                        />
                        <button type="button" className="text-xs text-steel hover:text-red-500"
                          onClick={() => setNowSections(p => p.filter((_, j) => j !== i))}>
                          Remove section
                        </button>
                      </div>
                    ))}
                    <button type="button" className="text-sm text-blue hover:underline"
                      onClick={() => setNowSections(p => [...p, { icon: '', title: '', items: '' }])}>
                      + Add section
                    </button>
                  </div>
                </section>

                {/* USES */}
                <section>
                  <h2 className="font-sans font-semibold text-ink text-base mb-3">/uses — what you use</h2>
                  <div className="space-y-4">
                    {usesCats.map((c, i) => (
                      <div key={i} className="rounded-2xl border border-mist bg-white p-4 space-y-2">
                        <div className="flex gap-2">
                          <input
                            className={inputCls + ' max-w-[120px]'}
                            placeholder="Icon"
                            value={c.icon}
                            onChange={e => setUsesCats(p => p.map((x, j) => j === i ? { ...x, icon: e.target.value } : x))}
                          />
                          <input
                            className={inputCls}
                            placeholder="Category (e.g. Hardware)"
                            value={c.title}
                            onChange={e => setUsesCats(p => p.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                          />
                        </div>
                        <textarea
                          className={inputCls + ' min-h-[80px] resize-y'}
                          placeholder="One per line — &quot;Name — note&quot;"
                          value={c.items}
                          onChange={e => setUsesCats(p => p.map((x, j) => j === i ? { ...x, items: e.target.value } : x))}
                        />
                        <button type="button" className="text-xs text-steel hover:text-red-500"
                          onClick={() => setUsesCats(p => p.filter((_, j) => j !== i))}>
                          Remove category
                        </button>
                      </div>
                    ))}
                    <button type="button" className="text-sm text-blue hover:underline"
                      onClick={() => setUsesCats(p => [...p, { icon: '', title: '', items: '' }])}>
                      + Add category
                    </button>
                  </div>
                </section>
              </>
            ) : (
              <section className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={bookingEnabled} onChange={e => setBookingEnabled(e.target.checked)} />
                  Accepting bookings {ctx.timezone ? `(${ctx.timezone})` : ''}
                </label>
                {days.map((d, i) => (
                  <div key={i} className="rounded-2xl border border-mist bg-white p-4">
                    <label className="flex items-center gap-2 mb-2 text-sm font-medium text-ink">
                      <input type="checkbox" checked={d.enabled}
                        onChange={e => setDays(p => p.map((x, j) => j === i ? { ...x, enabled: e.target.checked } : x))} />
                      {DAYS[i]}
                    </label>
                    {d.enabled && (
                      <div className="flex flex-wrap items-center gap-3 pl-6">
                        <input type="time" className={inputCls + ' max-w-[130px]'} value={d.start_time}
                          onChange={e => setDays(p => p.map((x, j) => j === i ? { ...x, start_time: e.target.value } : x))} />
                        <span className="text-steel text-sm">to</span>
                        <input type="time" className={inputCls + ' max-w-[130px]'} value={d.end_time}
                          onChange={e => setDays(p => p.map((x, j) => j === i ? { ...x, end_time: e.target.value } : x))} />
                        <div className="flex gap-3">
                          {[15, 30].map(dur => (
                            <label key={dur} className="flex items-center gap-1 text-xs text-steel">
                              <input type="checkbox" checked={d.durations.includes(dur)}
                                onChange={e => setDays(p => p.map((x, j) => {
                                  if (j !== i) return x
                                  const set = new Set(x.durations)
                                  e.target.checked ? set.add(dur) : set.delete(dur)
                                  return { ...x, durations: [...set] }
                                }))} />
                              {dur}m
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </section>
            )}

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={state === 'saving'}
              className="w-full rounded-lg bg-blue py-3 text-white font-medium text-sm disabled:opacity-60"
            >
              {state === 'saving' ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
