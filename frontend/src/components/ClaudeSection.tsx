import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X } from 'lucide-react'
import { api, type ClaudeUsage, type ClaudeDay } from '../lib/api'

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

const CELL = 11
const GAP = 3

/* ─── Heatmap ──────────────────────────────────────────────────────── */

interface SelectedDay {
  date: string
  tokens: number
  cost_cents: number
  sessions: number
}

function TokenHeatmap({ days }: { days: ClaudeDay[] }) {
  const [selected, setSelected] = useState<SelectedDay | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  // Build a map for quick lookup
  const byDate = new Map<string, ClaudeDay>(days.map(d => [d.date, d]))

  // Fill a full 53-week grid ending today
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // Find the Sunday on or before today
  const endSunday = new Date(today)
  endSunday.setDate(today.getDate() + (7 - today.getDay()) % 7 === 0 ? 0 : (7 - today.getDay()) % 7)
  // Actually: align to Saturday (end of week) or just use 53 weeks back from today's week
  // We'll use the same approach as GitHub: fill 53 weeks back from today
  const gridDays: { date: string; tokens: number }[] = []
  const start = new Date(today)
  // Go back to the Sunday of 52 weeks ago
  start.setDate(today.getDate() - today.getDay() - 52 * 7)

  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10)
    gridDays.push({ date: iso, tokens: byDate.get(iso)?.tokens ?? 0 })
  }

  // Chunk into weeks of 7
  const weeks: { date: string; tokens: number }[][] = []
  for (let i = 0; i < gridDays.length; i += 7) {
    weeks.push(gridDays.slice(i, i + 7))
  }

  // Month labels
  const monthLabels: { text: string; col: number }[] = []
  let prevMonth = -1
  for (let wi = 0; wi < weeks.length; wi++) {
    const day = weeks[wi][0]
    if (!day) continue
    const m = new Date(day.date + 'T00:00:00').getMonth()
    if (m !== prevMonth) {
      prevMonth = m
      monthLabels.push({
        text: new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' }),
        col: wi,
      })
    }
  }

  const totalWeeks = weeks.length

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
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 200)
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    })

  const fmt = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}k` : `${n}`

  return (
    <div>
      <div className="overflow-x-auto pb-2 -mx-1 px-1">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `24px repeat(${totalWeeks}, ${CELL}px)`,
            gridTemplateRows: `16px repeat(7, ${CELL}px)`,
            columnGap: GAP,
            rowGap: GAP,
            width: 'max-content',
          }}
        >
          {/* Month labels */}
          {monthLabels.map((m, i) => {
            const startCol = m.col + 2
            const endCol = i < monthLabels.length - 1 ? monthLabels[i + 1].col + 2 : totalWeeks + 2
            const span = endCol - startCol
            if (span < 3) return null
            return (
              <div
                key={i}
                className="font-mono text-[10px] text-slate leading-4 overflow-hidden whitespace-nowrap"
                style={{ gridColumn: `${startCol} / span ${span}`, gridRow: 1 }}
              >
                {m.text}
              </div>
            )
          })}

          {/* Day-of-week labels */}
          {['', 'M', '', 'W', '', 'F', ''].map((label, row) => (
            <div
              key={row}
              className="font-mono text-[9px] text-slate text-right pr-0.5"
              style={{ gridColumn: 1, gridRow: row + 2, lineHeight: `${CELL}px` }}
            >
              {label}
            </div>
          ))}

          {/* Cells */}
          {weeks.map((week, wi) =>
            week.map((day, di) => {
              const level = tokenLevel(day.tokens)
              const isSelected = selected?.date === day.date
              return (
                <div
                  key={`${wi}-${di}`}
                  className={`rounded-[2px] cursor-pointer transition-shadow ${
                    isSelected ? 'ring-2 ring-ink shadow-sm' : 'hover:ring-1 hover:ring-ink/40'
                  }`}
                  style={{
                    gridColumn: wi + 2,
                    gridRow: di + 2,
                    width: CELL,
                    height: CELL,
                    background: LEVEL_FILLS[level],
                  }}
                  onClick={() => handleClick(day)}
                />
              )
            }),
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-1 justify-end">
        <span className="font-mono text-[10px] text-steel mr-1">Less</span>
        {LEVEL_FILLS.map((fill, i) => (
          <div key={i} className="w-[10px] h-[10px] rounded-[2px]" style={{ background: fill }} />
        ))}
        <span className="font-mono text-[10px] text-steel ml-1">More</span>
      </div>

      {/* Detail panel */}
      <AnimatePresence>
        {selected && (
          <motion.div
            ref={detailRef}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="mt-4 p-4 bg-white border border-mist rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-sm font-semibold text-ink">
                  {formatDate(selected.date)}
                </span>
                <button
                  onClick={() => setSelected(null)}
                  className="text-silver hover:text-ink transition-colors p-0.5"
                >
                  <X size={14} />
                </button>
              </div>
              {selected.tokens === 0 ? (
                <p className="font-mono text-xs text-steel">No Claude activity this day.</p>
              ) : (
                <div className="flex gap-6 flex-wrap">
                  <div>
                    <p className="font-mono text-[11px] text-steel uppercase tracking-wide mb-0.5">Tokens</p>
                    <p className="font-mono text-sm text-ink font-semibold">{fmt(selected.tokens)}</p>
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
