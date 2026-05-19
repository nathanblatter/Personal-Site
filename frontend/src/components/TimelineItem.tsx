import { motion } from 'motion/react'

interface TimelineItemProps {
  year: string
  title: string
  subtitle: string
  description: string
  index: number
  active?: boolean
  highlighted?: boolean
  note?: string
}

export default function TimelineItem({ year, title, subtitle, description, index, active, highlighted, note }: TimelineItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.15 }}
      className="relative pl-10 md:pl-14 pb-14 last:pb-0 group"
    >
      {/* Vertical line */}
      <div className="absolute left-0 top-0 bottom-0 w-px bg-mist" />

      {/* Dot */}
      <div
        className={`absolute left-0 top-2 w-3 h-3 rounded-full -translate-x-1/2 border-2 transition-colors ${
          highlighted
            ? 'bg-blue border-blue shadow-[0_0_12px_rgba(59,108,245,0.4)]'
            : active
            ? 'bg-blue border-blue shadow-[0_0_12px_rgba(59,108,245,0.3)]'
            : 'bg-white border-silver group-hover:border-blue'
        }`}
      />

      {/* Content */}
      <span className="font-mono text-xs text-blue tracking-wider">{year}</span>
      <h4 className={`text-xl font-sans font-semibold mt-2 ${highlighted ? 'text-blue' : 'text-ink'}`}>{title}</h4>
      <p className="text-sm text-steel mt-1">{subtitle}</p>
      <p className="text-sm text-slate mt-4 leading-relaxed max-w-lg">{description}</p>
      {note && (
        <p className="text-sm text-blue/80 mt-3 leading-relaxed max-w-lg italic border-l-2 border-blue/30 pl-3">{note}</p>
      )}
    </motion.div>
  )
}
