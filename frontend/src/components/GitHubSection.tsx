import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Github, Star, GitFork, ExternalLink } from 'lucide-react'
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

const LEVEL_COLORS = [
  'bg-[#ebedf0]',
  'bg-teal/25',
  'bg-teal/45',
  'bg-teal/70',
  'bg-teal',
]

function ContributionGraph({ data }: { data: GitHubContributions }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<{
    x: number
    y: number
    date: string
    level: number
    repos: { name: string; url: string }[]
  } | null>(null)
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)

  const weeks: { date: string; level: number }[][] = []
  for (let i = 0; i < data.days.length; i += 7) {
    weeks.push(data.days.slice(i, i + 7))
  }

  // Month labels positioned above the grid
  const monthLabels: { text: string; weekIndex: number }[] = []
  let lastMonth = -1
  for (let wi = 0; wi < weeks.length; wi++) {
    const firstDay = weeks[wi][0]
    if (!firstDay) continue
    const month = new Date(firstDay.date + 'T00:00:00').getMonth()
    if (month !== lastMonth) {
      lastMonth = month
      monthLabels.push({
        text: new Date(firstDay.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' }),
        weekIndex: wi,
      })
    }
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    })

  const showTooltip = (e: React.MouseEvent, day: { date: string; level: number }) => {
    clearTimeout(tooltipTimeout.current)
    const rect = e.currentTarget.getBoundingClientRect()
    const container = containerRef.current?.getBoundingClientRect()
    if (!container) return
    setTooltip({
      x: rect.left - container.left + rect.width / 2,
      y: rect.top - container.top,
      date: day.date,
      level: day.level,
      repos: data.activity?.[day.date] || [],
    })
  }

  const hideTooltip = () => {
    tooltipTimeout.current = setTimeout(() => setTooltip(null), 150)
  }

  const keepTooltip = () => clearTimeout(tooltipTimeout.current)

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-6 mb-4">
        <div className="font-mono text-xs text-steel">
          <span className="text-ink font-semibold text-sm">{data.total.toLocaleString()}</span> contributions in the last year
        </div>
        {data.streak > 0 && (
          <div className="font-mono text-xs text-steel">
            <span className="text-ink font-semibold text-sm">{data.streak}</span> day streak
          </div>
        )}
      </div>

      {/* Month labels */}
      <div className="flex mb-1 ml-[30px]">
        {monthLabels.map((m, i) => {
          const nextWeek = monthLabels[i + 1]?.weekIndex ?? weeks.length
          const span = nextWeek - m.weekIndex
          return (
            <div
              key={i}
              className="font-mono text-[10px] text-steel shrink-0"
              style={{ width: span * 14 }}
            >
              {m.text}
            </div>
          )
        })}
      </div>

      {/* Grid with day labels */}
      <div className="flex">
        <div className="flex flex-col gap-[3px] mr-1.5 pt-0">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
            <div
              key={d}
              className="h-[11px] font-mono text-[9px] text-steel leading-[11px] text-right"
              style={{ visibility: i % 2 === 1 ? 'visible' : 'hidden' }}
            >
              {d}
            </div>
          ))}
        </div>
        <div className="flex gap-[3px] overflow-x-auto pb-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day, di) => (
                <div
                  key={di}
                  className={`w-[11px] h-[11px] rounded-[2px] ${LEVEL_COLORS[day.level]} cursor-pointer hover:ring-1 hover:ring-ink/40 transition-shadow`}
                  onMouseEnter={(e) => showTooltip(e, day)}
                  onMouseLeave={hideTooltip}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {tooltip && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50"
            style={{ left: tooltip.x, top: tooltip.y - 8, transform: 'translate(-50%, -100%)' }}
            onMouseEnter={keepTooltip}
            onMouseLeave={hideTooltip}
          >
            <div className="bg-ink text-white text-xs rounded-lg px-3 py-2 shadow-lg min-w-[160px]">
              <div className="font-semibold mb-1">{formatDate(tooltip.date)}</div>
              {tooltip.level === 0 ? (
                <div className="text-white/60">No contributions</div>
              ) : tooltip.repos.length > 0 ? (
                <div className="space-y-1">
                  {tooltip.repos.map((repo) => (
                    <a
                      key={repo.name}
                      href={repo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-teal hover:text-white transition-colors"
                    >
                      <ExternalLink size={10} className="shrink-0" />
                      {repo.name}
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-white/60">Active</div>
              )}
              {/* Arrow */}
              <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-ink" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

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
