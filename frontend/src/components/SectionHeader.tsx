import { motion } from 'motion/react'

interface SectionHeaderProps {
  code: string
  title: string
  subtitle?: string
  /** 1 for the page's main heading (one h1 per page); default 2 for in-page sections */
  level?: 1 | 2
}

export default function SectionHeader({ code, title, subtitle, level = 2 }: SectionHeaderProps) {
  const Heading = level === 1 ? 'h1' : 'h2'
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px' }}
      transition={{ duration: 0.2 }}
      className="mb-12 md:mb-20 text-center"
    >
      <div className="flex items-center justify-center gap-4 mb-4 md:mb-5">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-mist max-w-20 md:max-w-32" />
        <span className="font-mono text-[10px] md:text-xs text-blue tracking-widest">{code}</span>
        <div className="h-px flex-1 bg-gradient-to-r from-mist to-transparent max-w-20 md:max-w-32" />
      </div>
      <Heading className="font-serif text-4xl sm:text-5xl md:text-7xl italic text-ink leading-none">
        {title}
      </Heading>
      {subtitle && (
        <p className="mt-4 md:mt-5 text-steel text-base md:text-lg max-w-xl mx-auto leading-relaxed">{subtitle}</p>
      )}
    </motion.div>
  )
}
