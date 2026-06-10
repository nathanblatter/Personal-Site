import { useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X } from 'lucide-react'

const CELL = 11
const GAP = 3

function formatHeatmapDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

interface HeatmapGridProps<T extends { date: string }> {
  weeks: T[][]
  levelFills: string[]
  getLevel: (day: T) => number
  selectedDate: string | null
  onCellClick: (day: T) => void
  onDeselect: () => void
  renderDetail?: () => React.ReactNode
}

export default function HeatmapGrid<T extends { date: string }>({
  weeks,
  levelFills,
  getLevel,
  selectedDate,
  onCellClick,
  onDeselect,
  renderDetail,
}: HeatmapGridProps<T>) {
  const detailRef = useRef<HTMLDivElement>(null)

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
              const level = getLevel(day)
              const isSelected = selectedDate === day.date
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
                    background: levelFills[level],
                  }}
                  onClick={() => {
                    onCellClick(day)
                    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 200)
                  }}
                />
              )
            }),
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-1 justify-end">
        <span className="font-mono text-[10px] text-steel mr-1">Less</span>
        {levelFills.map((fill, i) => (
          <div key={i} className="w-[10px] h-[10px] rounded-[2px]" style={{ background: fill }} />
        ))}
        <span className="font-mono text-[10px] text-steel ml-1">More</span>
      </div>

      {/* Detail panel */}
      <AnimatePresence>
        {selectedDate && renderDetail && (
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
                  {formatHeatmapDate(selectedDate)}
                </span>
                <button
                  onClick={onDeselect}
                  className="text-silver hover:text-ink transition-colors p-0.5"
                >
                  <X size={14} />
                </button>
              </div>
              {renderDetail()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
