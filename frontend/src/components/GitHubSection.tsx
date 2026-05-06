import { useState, useEffect, useCallback } from 'react'
import { motion } from 'motion/react'
import { Github, Star, GitFork, ExternalLink } from 'lucide-react'
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
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

const LEVEL_FILLS = ['#e8ecf0', '#5eead433', '#5eead473', '#5eead4b3', '#5eead4']

interface HeatmapPoint {
  week: number
  day: number
  date: string
  level: number
  repos: { name: string; url: string }[]
}

function ContributionTooltip({ active, payload }: { active?: boolean; payload?: { payload: HeatmapPoint }[] }) {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload
  const formatted = new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
  return (
    <div className="bg-ink text-white text-xs rounded-lg px-3 py-2 shadow-lg min-w-[160px]">
      <div className="font-semibold mb-1">{formatted}</div>
      {d.level === 0 ? (
        <div className="text-white/60">No contributions</div>
      ) : d.repos.length > 0 ? (
        <div className="space-y-1">
          {d.repos.map((repo) => (
            <a
              key={repo.name}
              href={repo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-teal hover:text-white transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={10} className="shrink-0" />
              {repo.name}
            </a>
          ))}
        </div>
      ) : (
        <div className="text-white/60">Active</div>
      )}
    </div>
  )
}

function HeatmapCell(props: { cx: number; cy: number; payload: HeatmapPoint }) {
  const { cx, cy, payload } = props
  return (
    <rect
      x={cx - 5.5}
      y={cy - 5.5}
      width={11}
      height={11}
      rx={2}
      fill={LEVEL_FILLS[payload.level]}
      className="cursor-pointer transition-opacity hover:opacity-80"
      stroke={payload.level > 0 ? '#5eead4' : 'none'}
      strokeWidth={0}
    />
  )
}

function ContributionGraph({ data }: { data: GitHubContributions }) {
  const points: HeatmapPoint[] = data.days.map((d, i) => ({
    week: Math.floor(i / 7),
    day: i % 7,
    date: d.date,
    level: d.level,
    repos: data.activity?.[d.date] || [],
  }))

  const totalWeeks = Math.ceil(data.days.length / 7)

  // Month labels
  const monthTicks: { week: number; label: string }[] = []
  let lastMonth = -1
  for (const p of points) {
    const month = new Date(p.date + 'T00:00:00').getMonth()
    if (month !== lastMonth) {
      lastMonth = month
      monthTicks.push({
        week: p.week,
        label: new Date(p.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' }),
      })
    }
  }

  const formatWeekTick = useCallback((week: number) => {
    const tick = monthTicks.find(t => t.week === week)
    return tick ? tick.label : ''
  }, [monthTicks])

  const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']

  return (
    <div>
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

      <ResponsiveContainer width="100%" height={130}>
        <ScatterChart margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <XAxis
            type="number"
            dataKey="week"
            domain={[0, totalWeeks - 1]}
            tick={{ fontSize: 10, fill: '#8c95a6' }}
            tickLine={false}
            axisLine={false}
            ticks={monthTicks.map(t => t.week)}
            tickFormatter={formatWeekTick}
            interval={0}
          />
          <YAxis
            type="number"
            dataKey="day"
            domain={[0, 6]}
            tick={{ fontSize: 10, fill: '#8c95a6' }}
            tickLine={false}
            axisLine={false}
            ticks={[1, 3, 5]}
            tickFormatter={(d: number) => DAY_LABELS[d]}
            reversed
            width={28}
          />
          <Tooltip
            content={<ContributionTooltip />}
            cursor={false}
            wrapperStyle={{ zIndex: 50, pointerEvents: 'auto' }}
            allowEscapeViewBox={{ x: true, y: true }}
          />
          <Scatter data={points} shape={<HeatmapCell cx={0} cy={0} payload={points[0]} />} isAnimationActive={false}>
            {points.map((_, i) => (
              <Cell key={i} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-1 justify-end font-mono text-[10px] text-steel">
        <span className="mr-1">Less</span>
        {LEVEL_FILLS.map((fill, i) => (
          <div key={i} className="w-[11px] h-[11px] rounded-[2px]" style={{ background: fill }} />
        ))}
        <span className="ml-1">More</span>
      </div>
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
