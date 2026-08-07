import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { api, type UsesContent } from '../lib/api'
import { contentIcon } from '../lib/contentIcons'
import Skeleton from '../components/Skeleton'
import { useDocumentMeta } from '../lib/useDocumentMeta'

function UsesSkeleton() {
  return (
    <div className="grid sm:grid-cols-2 gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-mist bg-white p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <Skeleton className="w-4 h-4 rounded" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="space-y-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// Fallback used only if the API is unreachable, so the page never renders blank.
const FALLBACK: UsesContent = {
  categories: [
    {
      icon: 'Server',
      title: 'Stack',
      items: [
        { name: 'React + TypeScript', note: 'Frontend' },
        { name: 'FastAPI + PostgreSQL', note: 'Backend' },
      ],
    },
  ],
}

export default function Uses() {
  useDocumentMeta({
    title: 'Uses — Nathan Blatter',
    description: 'The hardware, software, and services behind the things Nathan builds.',
    canonical: '/uses',
  })
  const [content, setContent] = useState<UsesContent | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api.siteContent.get<UsesContent>('uses')
      .then(res => { if (!cancelled) setContent(res.data) })
      .catch(() => { if (!cancelled) setContent(FALLBACK) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const categories = content?.categories ?? []

  return (
    <section className="py-16 md:py-24 min-h-screen">
      <div className="max-w-[760px] w-full mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <span className="font-mono text-xs text-blue tracking-[0.2em] uppercase">// USES</span>
          <h1 className="font-serif text-4xl md:text-5xl italic text-ink mt-3 mb-4">
            What I use
          </h1>
          <p className="text-steel leading-relaxed max-w-lg">
            The hardware, software, and services behind the things I build.
          </p>
        </motion.div>

        {loading ? (
          <UsesSkeleton />
        ) : (
          <div className="grid sm:grid-cols-2 gap-6">
            {categories.map((cat, i) => {
              const Icon = contentIcon(cat.icon)
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                  className="rounded-2xl border border-mist bg-white p-6"
                >
                  <div className="flex items-center gap-2.5 mb-4">
                    <Icon size={16} className="text-blue" />
                    <h2 className="font-sans font-semibold text-ink text-lg">{cat.title}</h2>
                  </div>
                  <ul className="space-y-3">
                    {cat.items.map((item, j) => (
                      <li key={j}>
                        <span className="text-ink font-medium text-sm">{item.name}</span>
                        {item.note && <span className="block text-steel text-xs mt-0.5">{item.note}</span>}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
