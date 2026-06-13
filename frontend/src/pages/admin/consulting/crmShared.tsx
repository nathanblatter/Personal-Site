/* Shared helpers + small presentational components for the Consulting CRM. */

export function fmtCents(cents?: number | null, currency = 'USD'): string {
  const sym = currency === 'USD' ? '$' : `${currency} `
  return `${sym}${((cents ?? 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Parse a dollar string ("1,200.50") into integer cents. Returns 0 on junk. */
export function dollarsToCents(v: string): number {
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

export function centsToDollars(cents?: number | null): string {
  if (cents == null) return ''
  return (cents / 100).toFixed(2)
}

export function fmtDate(d?: string | null): string {
  if (!d) return '—'
  const dt = new Date(d.length <= 10 ? `${d}T00:00:00` : d)
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

const STAGE_COLORS: Record<string, string> = {
  lead: 'bg-silver/30 text-steel',
  qualified: 'bg-blue/10 text-blue',
  proposal: 'bg-blue/15 text-blue',
  negotiation: 'bg-violet/15 text-violet',
  won: 'bg-teal/15 text-teal',
  lost: 'bg-ember/15 text-ember',
}

const INVOICE_COLORS: Record<string, string> = {
  draft: 'bg-silver/30 text-steel',
  sent: 'bg-blue/10 text-blue',
  partial: 'bg-violet/15 text-violet',
  paid: 'bg-teal/15 text-teal',
  overdue: 'bg-ember/15 text-ember',
  void: 'bg-silver/20 text-silver',
}

const ENGAGEMENT_COLORS: Record<string, string> = {
  active: 'bg-teal/15 text-teal',
  paused: 'bg-violet/15 text-violet',
  completed: 'bg-blue/10 text-blue',
  cancelled: 'bg-silver/20 text-steel',
}

const CONTRACT_COLORS: Record<string, string> = {
  draft: 'bg-silver/30 text-steel',
  sent: 'bg-blue/10 text-blue',
  accepted: 'bg-teal/15 text-teal',
  declined: 'bg-ember/15 text-ember',
  void: 'bg-silver/20 text-silver',
}

export function Pill({ label, kind = 'invoice' }: { label: string; kind?: 'stage' | 'invoice' | 'engagement' | 'contract' }) {
  const map = kind === 'stage' ? STAGE_COLORS : kind === 'engagement' ? ENGAGEMENT_COLORS : kind === 'contract' ? CONTRACT_COLORS : INVOICE_COLORS
  return (
    <span className={`inline-flex items-center font-mono text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${map[label] || 'bg-silver/20 text-steel'}`}>
      {label}
    </span>
  )
}

export function SubTabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="flex gap-1 border-b border-mist mb-6">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            active === t.id ? 'border-blue text-blue' : 'border-transparent text-steel hover:text-ink'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
