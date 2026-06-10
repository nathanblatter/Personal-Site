import { motion } from 'motion/react'

interface SkillBarProps {
  name: string
  category: string
  index: number
  highlighted?: boolean
}

export default function SkillBar({ name, category, index, highlighted }: SkillBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, delay: index * 0.04 }}
      className={`px-4 py-3 rounded-xl border bg-snow hover:border-blue/30 hover:bg-white transition-all ${highlighted ? 'border-blue/40 ring-2 ring-blue/20' : 'border-mist'}`}
    >
      <span className="block font-mono text-[10px] text-steel uppercase tracking-wider mb-1">
        {category}
      </span>
      <span className="text-sm text-ink font-medium">{name}</span>
    </motion.div>
  )
}
