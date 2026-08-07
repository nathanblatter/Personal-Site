import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { Flame, Trophy, CalendarDays } from 'lucide-react'
import { api, type ClaudeUsage, type ClaudeDay, type ClaudeProject } from '../lib/api'
import HeatmapGrid from './HeatmapGrid'
import Skeleton from './Skeleton'

/* ─── Token level helpers ──────────────────────────────────────────── */

function tokenLevel(tokens: number): number {
  if (tokens === 0) return 0
  if (tokens < 10_000) return 1
  if (tokens < 50_000) return 2
  if (tokens < 100_000) return 3
  return 4
}

const LEVEL_FILLS = [
  'var(--color-mist)',
  'rgba(139,92,246,0.20)',
  'rgba(139,92,246,0.40)',
  'rgba(139,92,246,0.65)',
  'var(--color-violet)',
]

/* ─── Heatmap ──────────────────────────────────────────────────────── */

interface SelectedDay {
  date: string
  tokens: number
  cost_cents: number
  sessions: number
}

function TokenHeatmap({ days }: { days: ClaudeDay[] }) {
  const [selected, setSelected] = useState<SelectedDay | null>(null)

  const byDate = new Map<string, ClaudeDay>(days.map(d => [d.date, d]))

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const gridDays: { date: string; tokens: number }[] = []
  const start = new Date(today)
  start.setDate(today.getDate() - today.getDay() - 52 * 7)

  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10)
    gridDays.push({ date: iso, tokens: byDate.get(iso)?.tokens ?? 0 })
  }

  const weeks: { date: string; tokens: number }[][] = []
  for (let i = 0; i < gridDays.length; i += 7) {
    weeks.push(gridDays.slice(i, i + 7))
  }

  const handleClick = (day: { date: string; tokens: number }) => {
    if (selected?.date === day.date) {
      setSelected(null)
      return
    }
    const full = byDate.get(day.date)
    setSelected({
      date: day.date,
      tokens: day.tokens,
      cost_cents: full?.cost_cents ?? 0,
      sessions: full?.sessions ?? 0,
    })
  }

  return (
    <HeatmapGrid
      weeks={weeks}
      levelFills={LEVEL_FILLS}
      getLevel={(day) => tokenLevel(day.tokens)}
      selectedDate={selected?.date ?? null}
      onCellClick={handleClick}
      onDeselect={() => setSelected(null)}
      getTooltip={(day) => {
        if (day.tokens === 0) return 'No Claude activity'
        const full = byDate.get(day.date)
        return (
          <>
            {fmtTokens(day.tokens)} tokens · ${((full?.cost_cents ?? 0) / 100).toFixed(2)}
            {(full?.sessions ?? 0) > 0 && <> · {full!.sessions} session{full!.sessions === 1 ? '' : 's'}</>}
          </>
        )
      }}
      renderDetail={selected ? () => (
        <>
          {selected.tokens === 0 ? (
            <p className="font-mono text-xs text-steel">No Claude activity this day.</p>
          ) : (
            <div className="flex gap-6 flex-wrap">
              <div>
                <p className="font-mono text-[11px] text-steel uppercase tracking-wide mb-0.5">Tokens</p>
                <p className="font-mono text-sm text-ink font-semibold">{fmtTokens(selected.tokens)}</p>
              </div>
              <div>
                <p className="font-mono text-[11px] text-steel uppercase tracking-wide mb-0.5">Cost</p>
                <p className="font-mono text-sm text-ink font-semibold">
                  ${(selected.cost_cents / 100).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="font-mono text-[11px] text-steel uppercase tracking-wide mb-0.5">Sessions</p>
                <p className="font-mono text-sm text-ink font-semibold">{selected.sessions}</p>
              </div>
            </div>
          )}
        </>
      ) : undefined}
    />
  )
}

/* ─── Main section ─────────────────────────────────────────────────── */

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return `${n}`
}

function fmtWeek(week: string) {
  // "2026-W31" -> "W31"
  const idx = week.indexOf('W')
  return idx >= 0 ? week.slice(idx) : week
}

/* ─── Project sparkline (weekly token trend) ──────────────────────────── */

function ProjectSparkline({ project }: { project: ClaudeProject }) {
  const weeks = project.sparkline
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  if (!weeks || weeks.length === 0) return null
  const max = Math.max(...weeks.map(w => w.tokens), 1)
  const hovered = hoverIdx !== null ? weeks[hoverIdx] : null

  return (
    <div className="relative">
      {hovered && (
        <div
          className="pointer-events-none absolute z-20 bottom-full mb-1 -translate-x-1/2 px-2 py-1 rounded-md bg-ink text-snow shadow-lg whitespace-nowrap font-mono text-[10px]"
          style={{ left: `${((hoverIdx! + 0.5) / weeks.length) * 100}%` }}
        >
          {fmtWeek(hovered.week)}: {fmtTokens(hovered.tokens)} tokens · ${(hovered.cost_cents / 100).toFixed(2)}
        </div>
      )}
      <div className="flex gap-[3px] h-6 mt-1.5" onMouseLeave={() => setHoverIdx(null)}>
        {weeks.map((w, i) => (
          <button
            key={w.week}
            type="button"
            aria-label={`${fmtWeek(w.week)}: ${fmtTokens(w.tokens)} tokens, $${(w.cost_cents / 100).toFixed(2)}`}
            className="flex-1 h-full flex items-end p-0 border-0 appearance-none bg-transparent cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-violet rounded-[1px]"
            onMouseEnter={() => setHoverIdx(i)}
            onFocus={() => setHoverIdx(i)}
            onBlur={() => setHoverIdx(null)}
            onClick={() => setHoverIdx(i)}
          >
            <div
              className={`w-full rounded-[1px] min-h-[2px] ${hoverIdx === i ? 'bg-violet' : 'bg-violet/50'}`}
              style={{ height: `${Math.max((w.tokens / max) * 100, w.tokens > 0 ? 8 : 0)}%` }}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

/* ─── Skeleton ─────────────────────────────────────────────────────────── */

function ClaudeSectionSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-6 p-5 bg-snow border border-mist rounded-xl">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-5 w-14" />
          </div>
        ))}
      </div>
      <div className="p-5 bg-snow border border-mist rounded-xl">
        <Skeleton className="h-24 w-full" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="p-5 bg-snow border border-mist rounded-xl space-y-2.5">
            <Skeleton className="h-2.5 w-20 mb-2" />
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ClaudeSection() {
  const [usage, setUsage] = useState<ClaudeUsage | null>(null)

  useEffect(() => {
    api.claude.usage().then(setUsage).catch(() => {})
  }, [])

  if (!usage) return <ClaudeSectionSkeleton />

  const { summary, days, models, projects } = usage

  // Max tokens for bar scaling
  const maxModelTokens = Math.max(...models.map(m => m.tokens), 1)
  const maxProjectTokens = Math.max(...projects.map(p => p.tokens), 1)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="space-y-6"
    >
      {/* Summary bar */}
      <div className="flex flex-wrap gap-6 p-5 bg-snow border border-mist rounded-xl">
        <div>
          <p className="font-mono text-[11px] text-steel uppercase tracking-wide mb-0.5">Total Cost</p>
          <p className="font-mono text-lg font-semibold text-ink">
            ${(summary.total_cost_cents / 100).toFixed(2)}
          </p>
        </div>
        <div>
          <p className="font-mono text-[11px] text-steel uppercase tracking-wide mb-0.5">Tokens</p>
          <p className="font-mono text-lg font-semibold text-ink">{fmtTokens(summary.total_tokens)}</p>
        </div>
        <div>
          <p className="font-mono text-[11px] text-steel uppercase tracking-wide mb-0.5">Sessions</p>
          <p className="font-mono text-lg font-semibold text-ink">{summary.total_sessions}</p>
        </div>
        <div>
          <p className="font-mono text-[11px] text-steel uppercase tracking-wide mb-0.5">Active Days</p>
          <p className="font-mono text-lg font-semibold text-ink">{summary.active_days}</p>
        </div>
        {summary.streak > 0 && (
          <div>
            <p className="font-mono text-[11px] text-steel uppercase tracking-wide mb-0.5">Streak</p>
            <p className="font-mono text-lg font-semibold text-ink flex items-center gap-1">
              <Flame size={14} className="text-violet" />
              {summary.streak}d
            </p>
          </div>
        )}
        {!!summary.longest_streak && summary.longest_streak > summary.streak && (
          <div>
            <p className="font-mono text-[11px] text-steel uppercase tracking-wide mb-0.5">Best Streak</p>
            <p className="font-mono text-lg font-semibold text-ink flex items-center gap-1">
              <Trophy size={14} className="text-violet" />
              {summary.longest_streak}d
            </p>
          </div>
        )}
      </div>

      {/* Last 30 days vs all-time */}
      {summary.last_30_days && (
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-steel">
          <CalendarDays size={13} className="text-steel" />
          <span>
            Last 30 days:{' '}
            <span className="text-ink font-semibold">
              ${(summary.last_30_days.cost_cents / 100).toFixed(2)}
            </span>{' '}
            · {fmtTokens(summary.last_30_days.tokens)} tokens · {summary.last_30_days.sessions} sessions ·{' '}
            {summary.last_30_days.active_days} active days
          </span>
        </div>
      )}

      {/* Heatmap */}
      <div className="p-5 bg-snow border border-mist rounded-xl">
        <TokenHeatmap days={days} />
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Models */}
        {models.length > 0 && (
          <div className="p-5 bg-snow border border-mist rounded-xl">
            <p className="font-mono text-[11px] text-steel uppercase tracking-wide mb-3">By Model</p>
            <div className="space-y-2.5">
              {models.map(m => (
                <div key={m.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs text-ink truncate">{m.name}</span>
                    <span className="font-mono text-[11px] text-steel ml-2 shrink-0">
                      ${(m.cost_cents / 100).toFixed(2)}
                      {typeof m.sessions === 'number' && m.sessions > 0 && (
                        <span className="text-silver"> · {m.sessions} sess</span>
                      )}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-mist overflow-hidden">
                    <div
                      className="h-full rounded-full bg-violet/60"
                      style={{ width: `${(m.tokens / maxModelTokens) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Projects */}
        {projects.length > 0 && (
          <div className="p-5 bg-snow border border-mist rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <p className="font-mono text-[11px] text-steel uppercase tracking-wide">By Project</p>
              {summary.most_active_project && (
                <p className="font-mono text-[11px] text-silver truncate ml-2">
                  Most active: <span className="text-steel">{summary.most_active_project}</span>
                </p>
              )}
            </div>
            <div className="space-y-3.5">
              {projects.map(p => (
                <div key={p.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs text-ink truncate">{p.name}</span>
                    <span className="font-mono text-[11px] text-steel ml-2 shrink-0">
                      ${(p.cost_cents / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-mist overflow-hidden">
                    <div
                      className="h-full rounded-full bg-violet/60"
                      style={{ width: `${(p.tokens / maxProjectTokens) * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    {typeof p.active_days === 'number' && (
                      <span className="font-mono text-[10px] text-silver">
                        {p.active_days} active day{p.active_days === 1 ? '' : 's'}
                        {typeof p.sessions === 'number' && p.sessions > 0 ? ` · ${p.sessions} sessions` : ''}
                      </span>
                    )}
                  </div>
                  <ProjectSparkline project={p} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
