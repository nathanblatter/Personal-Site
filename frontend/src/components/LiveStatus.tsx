import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { Clock, GitCommit } from 'lucide-react'
import { api, type DevStatusResponse, type GitHubRepo } from '../lib/api'

function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 2) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays}d ago`
  const diffWeeks = Math.floor(diffDays / 7)
  if (diffDays < 60) return `${diffWeeks}w ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

function devTypeLabel(type: DevStatusResponse['dev_type']): string {
  if (type === 'ssh') return 'SSH session active'
  if (type === 'vnc') return 'Screen Sharing active'
  if (type === 'both') return 'SSH + Screen Sharing'
  return ''
}

const STREAK_MAX_DISPLAY = 60

export default function LiveStatus() {
  const [devStatus, setDevStatus] = useState<DevStatusResponse | null>(null)
  const [lastPush, setLastPush] = useState<string | null>(null)
  const [streak, setStreak] = useState<number | null>(null)

  useEffect(() => {
    function load() {
      Promise.all([
        api.status.get().catch(() => null),
        api.github.repos().catch(() => null),
        api.github.contributions().catch(() => null),
      ]).then(([status, repos, contributions]) => {
        if (status) setDevStatus(status)
        if (repos && repos.length > 0) {
          const latest = repos.reduce<GitHubRepo>((best, r) =>
            new Date(r.updated_at) > new Date(best.updated_at) ? r : best
          , repos[0])
          setLastPush(latest.updated_at)
        }
        if (contributions) setStreak(contributions.streak)
      })
    }

    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [])

  const isActive = devStatus !== null && !devStatus.stale && devStatus.dev_active

  const streakFill = streak !== null
    ? Math.min(streak / STREAK_MAX_DISPLAY, 1)
    : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl border border-mist bg-snow px-6 py-5 space-y-4"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="font-mono text-[10px] text-blue tracking-[0.25em] uppercase">// live status</span>
      </div>

      {/* Dev row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-[3px] relative flex h-2.5 w-2.5 shrink-0">
            {isActive && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isActive ? 'bg-teal' : 'bg-silver'
              }`}
            />
          </span>
          <div>
            <p className="text-sm font-medium text-ink leading-tight">
              {isActive ? 'Actively coding' : 'Not at desk'}
            </p>
            {isActive && devStatus?.dev_type !== 'none' && (
              <p className="font-mono text-[11px] text-steel mt-0.5">
                {devTypeLabel(devStatus!.dev_type)}
              </p>
            )}
          </div>
        </div>
        {devStatus && (
          <span className="font-mono text-[10px] text-silver shrink-0 mt-0.5">
            {devStatus.stale ? 'no recent ping' : 'updated just now'}
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-mist" />

      {/* GitHub row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Clock size={13} className="mt-[3px] text-blue shrink-0" />
          <div>
            <p className="text-sm font-medium text-ink leading-tight">
              {lastPush ? `Last pushed ${relativeTime(lastPush)}` : 'GitHub'}
            </p>
            {streak !== null && (
              <div className="flex items-center gap-2 mt-1.5">
                <GitCommit size={11} className="text-steel" />
                <span className="font-mono text-[11px] text-steel">{streak}-day streak</span>
                <div className="flex gap-0.5">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <span
                      key={i}
                      className="inline-block h-1.5 w-1.5 rounded-sm"
                      style={{
                        backgroundColor:
                          i / 12 < streakFill
                            ? 'var(--color-teal)'
                            : 'var(--color-mist)',
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
