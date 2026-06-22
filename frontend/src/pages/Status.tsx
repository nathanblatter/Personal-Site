import { useState, useEffect, useCallback } from 'react'
import { motion } from 'motion/react'
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react'
import { api, type ServiceHealthResponse, type ServiceStatus } from '../lib/api'
import Skeleton from '../components/Skeleton'

const STATUS_META: Record<ServiceStatus, { label: string; color: string; dot: string; Icon: typeof CheckCircle2 }> = {
  operational: { label: 'Operational', color: 'text-teal', dot: 'bg-teal', Icon: CheckCircle2 },
  degraded: { label: 'Degraded', color: 'text-amber-500', dot: 'bg-amber-500', Icon: AlertTriangle },
  down: { label: 'Down', color: 'text-ember', dot: 'bg-ember', Icon: XCircle },
}

export default function Status() {
  const [data, setData] = useState<ServiceHealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const load = useCallback(() => {
    setError(false)
    api.health.services()
      .then(res => { setData(res); setUpdatedAt(new Date()) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 30000) // refresh every 30s
    return () => clearInterval(id)
  }, [load])

  const overall = data?.overall
  const overallMeta = overall ? STATUS_META[overall] : null

  return (
    <section className="py-16 md:py-24 min-h-screen">
      <div className="max-w-[720px] w-full mx-auto px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <span className="font-mono text-xs text-blue tracking-[0.2em] uppercase">// STATUS</span>
          <h1 className="font-serif text-4xl md:text-5xl italic text-ink mt-3 mb-4">System status</h1>
          <p className="text-steel leading-relaxed max-w-lg">
            Live health of the site and its self-hosted services. Refreshes automatically.
          </p>
        </motion.div>

        {/* Overall banner */}
        {!loading && !error && overallMeta && (
          <div className={`flex items-center gap-3 rounded-xl border border-mist bg-snow p-5 mb-6`}>
            <overallMeta.Icon size={22} className={overallMeta.color} />
            <span className="font-sans font-semibold text-ink text-lg">
              {overall === 'operational' ? 'All systems operational' : 'Some systems degraded'}
            </span>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="font-mono text-sm text-steel mb-3">Couldn't load status.</p>
            <button onClick={load} className="inline-flex items-center gap-2 font-mono text-xs text-blue hover:underline">
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {data?.services.map(svc => {
              const meta = STATUS_META[svc.status]
              return (
                <div key={svc.name} className="flex items-center justify-between rounded-xl border border-mist bg-white p-5">
                  <div className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full ${meta.dot} ${svc.status === 'operational' ? 'animate-pulse' : ''}`} />
                    <span className="text-ink font-medium">{svc.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {svc.latency_ms > 0 && (
                      <span className="font-mono text-xs text-silver">{svc.latency_ms}ms</span>
                    )}
                    <span className={`font-mono text-xs ${meta.color}`}>{meta.label}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {updatedAt && !error && (
          <p className="font-mono text-xs text-silver mt-6 text-center">
            Last checked {updatedAt.toLocaleTimeString()}
          </p>
        )}
      </div>
    </section>
  )
}
