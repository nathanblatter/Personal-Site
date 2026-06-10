import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { api, type ClaudeUsage, type ClaudeDay } from '../lib/api'
import HeatmapGrid from './HeatmapGrid'

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

export default function ClaudeSection() {
  const [usage, setUsage] = useState<ClaudeUsage | null>(null)

  useEffect(() => {
    api.claude.usage().then(setUsage).catch(() => {})
  }, [])

  if (!usage) return null

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
            <p className="font-mono text-lg font-semibold text-ink">{summary.streak}d</p>
          </div>
        )}
      </div>

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
            <p className="font-mono text-[11px] text-steel uppercase tracking-wide mb-3">By Project</p>
            <div className="space-y-2.5">
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
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
