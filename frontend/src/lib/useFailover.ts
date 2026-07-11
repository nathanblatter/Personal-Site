import { useEffect, useState } from 'react'

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
    if (cached !== null) { setFailover(cached); return }
    if (typeof window !== 'undefined' && window.__FAILOVER__ === true) {
      cached = true; setFailover(true); return
    }
    let alive = true
    fetch('/api/v1/__failover', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { cached = !!(j && j.failover); if (alive) setFailover(cached) })
      .catch(() => { cached = false })
    return () => { alive = false }
  }, [])

  return failover
}
