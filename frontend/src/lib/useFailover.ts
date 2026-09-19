import { useEffect, useState } from 'react'
import { cached as memo } from './requestCache'

declare global {
  interface Window { __FAILOVER__?: boolean }
}

// Probe the marker at most once per page load.
let cached: boolean | null = null

/**
 * True when the site is being served from the iMac static failover mirror
 * (the mini / API is down). In that mode the backend can't accept writes, so
 * contact / booking / newsletter submits are disabled.
 *
 * Signals, in order of reliability:
 *  1. window.__FAILOVER__ — the mirror's index.html sets it; reliable on fresh
 *     loads because the service worker is network-first for navigations.
 *  2. /api/v1/__failover — a runtime marker that only exists on the mirror,
 *     catching a mid-session failover (the API is never SW-cached, so it always
 *     reflects the live origin).
 */
export function useFailover(): boolean {
  const [failover, setFailover] = useState<boolean>(
    () => cached ?? (typeof window !== 'undefined' && window.__FAILOVER__ === true)
  )

  useEffect(() => {
    // Initial state already reflects `cached` / window.__FAILOVER__; nothing to probe.
    if (cached !== null) return
    if (typeof window !== 'undefined' && window.__FAILOVER__ === true) { cached = true; return }
    let alive = true
    // Shared promise: several components mount this hook on one page (banner,
    // newsletter, contact) and must not each probe the marker.
    memo('failover:probe', () =>
      fetch('/api/v1/__failover', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null))
    )
      .then(j => { cached = !!(j && j.failover); if (alive) setFailover(cached) })
      .catch(() => { cached = false })
    return () => { alive = false }
  }, [])

  return failover
}
