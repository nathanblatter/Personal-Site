import { useEffect, useRef, useState } from 'react'
import { Bug, Check, ImagePlus, X } from 'lucide-react'

const SEVERITIES = [
  { value: 'low', label: 'Minor — cosmetic' },
  { value: 'med', label: 'Medium — gets in the way' },
  { value: 'high', label: 'High — hard to use' },
  { value: 'urgent', label: 'Urgent — broken' },
]

const MAX_SHOTS = 4
const MAX_SHOT_BYTES = 8 * 1024 * 1024 // 8MB — mirrors the server cap
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

type Status = 'idle' | 'sending' | 'sent' | 'error'

type Shot = { id: string, file: File, url: string }

export default function BugReport() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [severity, setSeverity] = useState('med')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')
  const [shots, setShots] = useState<Shot[]>([])
  const [shotError, setShotError] = useState('')
  const [sentNote, setSentNote] = useState('')
  const [dragging, setDragging] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const shotsRef = useRef<Shot[]>([])
  shotsRef.current = shots

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    const id = window.setTimeout(() => ref.current?.focus(), 40)
    return () => { document.removeEventListener('keydown', onKey); window.clearTimeout(id) }
  }, [open])

  // Revoke any leftover object URLs on unmount.
  useEffect(() => () => { shotsRef.current.forEach((s) => URL.revokeObjectURL(s.url)) }, [])

  function close() {
    setOpen(false)
    window.setTimeout(() => {
      shotsRef.current.forEach((s) => URL.revokeObjectURL(s.url))
      setShots([]); setShotError(''); setSentNote(''); setDragging(false)
      setMessage(''); setSeverity('med'); setStatus('idle'); setError('')
    }, 200)
  }

  function addFiles(incoming: File[]) {
    setShotError('')
    const images = incoming.filter((f) => IMAGE_TYPES.includes(f.type))
    if (images.length < incoming.length) {
      setShotError('Only PNG, JPEG, WebP, or GIF images work here.')
    }
    const fit = images.filter((f) => f.size <= MAX_SHOT_BYTES)
    if (fit.length < images.length) {
      setShotError('Each screenshot must be 8MB or smaller.')
    }
    if (fit.length === 0) return
    setShots((prev) => {
      const room = MAX_SHOTS - prev.length
      if (room <= 0 || fit.length > room) setShotError(`Up to ${MAX_SHOTS} screenshots per report.`)
      const next = fit.slice(0, Math.max(room, 0)).map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        url: URL.createObjectURL(file),
      }))
      return [...prev, ...next]
    })
  }

  function removeShot(id: string) {
    setShots((prev) => {
      const gone = prev.find((s) => s.id === id)
      if (gone) URL.revokeObjectURL(gone.url)
      return prev.filter((s) => s.id !== id)
    })
    setShotError('')
  }

  function onPaste(e: React.ClipboardEvent) {
    const files = Array.from(e.clipboardData?.files ?? []).filter((f) => IMAGE_TYPES.includes(f.type))
    if (files.length) { e.preventDefault(); addFiles(files) }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    addFiles(Array.from(e.dataTransfer?.files ?? []))
  }

  async function uploadShots(itemId: string): Promise<boolean> {
    const form = new FormData()
    shotsRef.current.forEach((s) => form.append('files', s.file, s.file.name))
    try {
      const res = await fetch(`/api/v1/bug-report/${itemId}/screenshots`, { method: 'POST', body: form })
      return res.ok
    } catch {
      return false
    }
  }

  async function send() {
    const trimmed = message.trim()
    if (!trimmed) { setError('Add a quick description first.'); ref.current?.focus(); return }
    setStatus('sending'); setError('')
    try {
      const res = await fetch('/api/v1/bug-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          severity,
          url: window.location.href,
          meta: { path: window.location.pathname, viewport: `${window.innerWidth}x${window.innerHeight}`, userAgent: navigator.userAgent },
        }),
      })
      if (!res.ok) throw new Error()
      // Screenshots are best-effort: the report is already filed, so a failed
      // upload only downgrades to a soft warning.
      if (shotsRef.current.length > 0) {
        const { id } = await res.json().catch(() => ({ id: null }))
        const uploaded = id ? await uploadShots(id) : false
        if (!uploaded) setSentNote('Report filed, but the screenshots didn’t make it.')
      }
      setStatus('sent')
      window.setTimeout(close, 1800)
    } catch {
      setStatus('error'); setError('Could not send. Please try again.')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Report a bug"
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-blue px-4 py-3
                   font-mono text-xs tracking-wider text-white shadow-lg shadow-blue/25 transition
                   hover:-translate-y-0.5 hover:bg-blue-dim focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-glow"
      >
        <Bug size={15} />
        <span className="hidden sm:inline">Report a bug</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/50 p-4 backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}
        >
          <div role="dialog" aria-modal="true" aria-label="Report a bug"
               onPaste={onPaste}
               className="w-full max-w-md rounded-2xl border border-mist bg-white p-6 shadow-2xl">
            <h2 className="font-serif text-3xl leading-none text-ink">Spotted a bug?</h2>
            <p className="mt-1.5 font-sans text-sm text-steel">
              Tell me what happened — it goes straight to my board.
            </p>

            {status === 'sent' ? (
              <div className="mt-6 flex flex-col gap-1 rounded-xl bg-blue-wash px-4 py-6 text-blue">
                <div className="flex items-center gap-2">
                  <Check size={18} />
                  <span className="font-sans text-sm">Thanks — your report was filed.</span>
                </div>
                {sentNote && <span className="pl-7 font-sans text-xs text-steel">{sentNote}</span>}
              </div>
            ) : (
              <>
                <label htmlFor="ps-bug-msg" className="mt-5 block font-mono text-[11px] uppercase tracking-wider text-steel">
                  What went wrong?
                </label>
                <textarea id="ps-bug-msg" ref={ref} value={message} onChange={(e) => setMessage(e.target.value)}
                  rows={4} maxLength={5000} placeholder="What you saw, and what you expected…"
                  className="mt-2 w-full resize-y rounded-lg border border-mist bg-snow p-3 font-sans text-sm text-ink
                             placeholder-silver focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/20" />

                <label htmlFor="ps-bug-sev" className="mt-4 block font-mono text-[11px] uppercase tracking-wider text-steel">
                  How bad is it?
                </label>
                <select id="ps-bug-sev" value={severity} onChange={(e) => setSeverity(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-mist bg-snow p-2.5 font-sans text-sm text-ink focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/20">
                  {SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>

                <span className="mt-4 block font-mono text-[11px] uppercase tracking-wider text-steel">
                  Screenshots <span className="normal-case tracking-normal text-silver">(optional, up to {MAX_SHOTS})</span>
                </span>
                <input ref={fileRef} type="file" multiple accept={IMAGE_TYPES.join(',')} className="hidden"
                  onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = '' }} />
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={`mt-2 rounded-lg border border-dashed p-3 transition
                              ${dragging ? 'border-blue bg-blue-wash' : 'border-mist bg-snow'}`}
                >
                  {shots.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {shots.map((s) => (
                        <div key={s.id} className="relative">
                          <img src={s.url} alt={s.file.name} loading="lazy" decoding="async"
                               className="h-14 w-14 rounded-md border border-mist object-cover" />
                          <button type="button" onClick={() => removeShot(s.id)} aria-label={`Remove ${s.file.name}`}
                            className="absolute -right-1.5 -top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full
                                       bg-ink text-white transition hover:bg-ember">
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button type="button" onClick={() => fileRef.current?.click()}
                    disabled={shots.length >= MAX_SHOTS}
                    className="flex items-center gap-2 font-sans text-xs text-steel transition hover:text-ink disabled:opacity-50">
                    <ImagePlus size={14} />
                    <span>{shots.length >= MAX_SHOTS ? 'Screenshot limit reached' : 'Add images — or drop / paste them here'}</span>
                  </button>
                </div>
                {shotError && <p className="mt-1.5 font-sans text-xs text-ember">{shotError}</p>}

                <div className="mt-5 flex items-center gap-3">
                  <span className="mr-auto font-sans text-xs text-ember">{error}</span>
                  <button type="button" onClick={close} className="font-mono text-xs tracking-wider text-steel transition hover:text-ink">Cancel</button>
                  <button type="button" onClick={send} disabled={status === 'sending'}
                    className="rounded-lg bg-blue px-4 py-2 font-mono text-xs tracking-wider text-white transition hover:bg-blue-dim disabled:opacity-60">
                    {status === 'sending' ? 'Sending…' : 'Send report'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
