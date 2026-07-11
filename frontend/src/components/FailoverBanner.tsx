import { AlertTriangle } from 'lucide-react'
import { useFailover } from '../lib/useFailover'

/**
 * Slim bottom bar shown only while the site is served from the static failover
 * mirror. Inline amber styling so it never depends on a purgeable utility class.
 */
export default function FailoverBanner() {
  const failover = useFailover()
  if (!failover) return null
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[60] border-t"
      style={{ backgroundColor: '#f59e0b', borderColor: 'rgba(120,53,15,0.35)', color: '#451a03' }}
      role="status"
    >
      <div className="max-w-[1100px] mx-auto px-6 py-2 flex items-center justify-center gap-2.5 text-center">
        <AlertTriangle size={14} className="shrink-0" />
        <span className="font-mono text-[11px] sm:text-xs tracking-wide">
          Serving from backup — live messaging &amp; booking are paused. Everything else works normally.
        </span>
      </div>
    </div>
  )
}
