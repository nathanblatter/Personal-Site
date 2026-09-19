import { useEffect } from 'react'

/**
 * Intentionally renders nothing.
 *
 * The site's only analytics is self-hosted Umami, which is cookieless and
 * stores no personal data — so there is no consent to collect and the old
 * "no tracking cookies here" banner only added friction on first visit. The
 * component is kept as a no-op until Layout.tsx drops its import; it also
 * clears the stale `cookie-consent` key the old banner left in localStorage.
 */
export default function CookieBanner() {
  useEffect(() => {
    try { localStorage.removeItem('cookie-consent') } catch { /* storage unavailable */ }
  }, [])
  return null
}
