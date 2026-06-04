import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Github, Star, GitFork, ExternalLink, X } from 'lucide-react'
import { api, type GitHubProfile, type GitHubRepo, type GitHubContributions } from '../lib/api'

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Java: '#b07219',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Go: '#00ADD8',
  Rust: '#dea584',
  C: '#555555',
  'C++': '#f34b7d',
  'C#': '#178600',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Shell: '#89e051',
}

/* ─── Contribution heatmap ─────────────────────────────────────────── */

const LEVEL_FILLS = [
  'var(--color-mist)',
  'rgba(56,178,172,0.20)',
  'rgba(56,178,172,0.40)',
  'rgba(56,178,172,0.65)',
  'var(--color-teal)',
]

const CELL = 11
const GAP = 3

interface SelectedDay {
  date: string
  level: number
  repos: { name: string; url: string }[]
}

function ContributionGraph({ data }: { data: GitHubContributions }) {
  const [selected, setSelected] = useState<SelectedDay | null>(null)
  const detailRef = useRef<HTMLDivElement>(null)

  const weeks: { date: string; level: number }[][] = []
  for (let i = 0; i < data.days.length; i += 7) {
    weeks.push(data.days.slice(i, i + 7))
  }

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

  const handleClick = (day: { date: string; level: number }) => {
    if (selected?.date === day.date) {
      setSelected(null)
    } else {
      setSelected({
        date: day.date,
        level: day.level,
        repos: data.activity?.[day.date] || [],
      })
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 200)
    }
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    })

  const totalWeeks = weeks.length

  return (
    <div>
      {/* Stats */}
      <div className="flex items-center gap-6 mb-4">
        <div className="font-mono text-xs text-steel">
          <span className="text-ink font-semibold text-sm">{data.total.toLocaleString()}</span>{' '}
          contributions in the last year
        </div>
        {data.streak > 0 && (
          <div className="font-mono text-xs text-steel">
            <span className="text-ink font-semibold text-sm">{data.streak}</span> day streak
          </div>
        )}
      </div>

      {/* Grid */}
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
            const endCol = i < monthLabels.length - 1
              ? monthLabels[i + 1].col + 2
              : totalWeeks + 2
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
              const isSelected = selected?.date === day.date
              return (
                <div
                  key={`${wi}-${di}`}
                  className={`rounded-[2px] cursor-pointer transition-shadow ${
                    isSelected
                      ? 'ring-2 ring-ink shadow-sm'
                      : 'hover:ring-1 hover:ring-ink/40'
                  }`}
                  style={{
                    gridColumn: wi + 2,
                    gridRow: di + 2,
                    width: CELL,
                    height: CELL,
                    background: LEVEL_FILLS[day.level],
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

      {/* Selected day detail panel */}
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
              <div className="flex items-center justify-between mb-2">
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

              {selected.level === 0 ? (
                <p className="font-mono text-xs text-steel">No contributions this day.</p>
              ) : selected.repos.length > 0 ? (
                <div className="space-y-1.5 mt-2">
                  <p className="font-mono text-[11px] text-steel uppercase tracking-wide">Repos worked on</p>
                  {selected.repos.map((repo) => (
                    <a
                      key={repo.name}
                      href={repo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-ink hover:text-blue transition-colors py-1"
                    >
                      <Github size={14} className="shrink-0 text-steel" />
                      <span className="font-mono">{repo.name}</span>
                      <ExternalLink size={11} className="shrink-0 text-silver" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="font-mono text-xs text-steel">Active this day.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ─── Repo card ────────────────────────────────────────────────────── */

function RepoCard({ repo }: { repo: GitHubRepo }) {
  return (
    <a
      href={repo.html_url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block p-4 bg-white border border-mist rounded-xl hover:border-blue/30 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm font-medium text-ink group-hover:text-blue transition-colors truncate">
          {repo.name}
        </span>
        <ExternalLink size={12} className="text-silver group-hover:text-blue transition-colors shrink-0 mt-0.5" />
      </div>
      {repo.description && (
        <p className="text-xs text-steel leading-relaxed mb-3 line-clamp-2">{repo.description}</p>
      )}
      <div className="flex items-center gap-4">
        {repo.language && (
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-steel">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: LANG_COLORS[repo.language] || '#8c95a6' }}
            />
            {repo.language}
          </span>
        )}
        {repo.stars > 0 && (
          <span className="flex items-center gap-1 font-mono text-[11px] text-steel">
            <Star size={11} /> {repo.stars}
          </span>
        )}
        {repo.forks > 0 && (
          <span className="flex items-center gap-1 font-mono text-[11px] text-steel">
            <GitFork size={11} /> {repo.forks}
          </span>
        )}
      </div>
    </a>
  )
}

/* ─── Main section ─────────────────────────────────────────────────── */

export default function GitHubSection({ compact = false }: { compact?: boolean }) {
  const [profile, setProfile] = useState<GitHubProfile | null>(null)
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [contributions, setContributions] = useState<GitHubContributions | null>(null)

  useEffect(() => {
    Promise.all([api.github.profile(), api.github.repos(), api.github.contributions()])
      .then(([p, r, c]) => {
        setProfile(p)
        setRepos(r)
        setContributions(c)
      })
      .catch(() => {})
  }, [])

  if (!profile || !contributions) return null

  const topRepos = repos
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, compact ? 4 : 6)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <a
          href={profile.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3"
        >
          <Github size={20} className="text-ink" />
          <span className="font-mono text-sm text-steel group-hover:text-blue transition-colors">
            @{profile.username}
          </span>
          <span className="font-mono text-[11px] text-silver">
            {profile.public_repos} repos
          </span>
        </a>
      </div>

      {/* Contribution graph */}
      <div className="p-5 bg-snow border border-mist rounded-xl">
        <ContributionGraph data={contributions} />
      </div>

      {/* Repos grid */}
      <div className={`grid gap-3 ${compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'}`}>
        {topRepos.map(repo => (
          <RepoCard key={repo.name} repo={repo} />
        ))}
      </div>
    </motion.div>
  )
}
