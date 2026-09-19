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
