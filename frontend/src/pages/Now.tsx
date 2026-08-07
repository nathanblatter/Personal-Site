import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { api, type NowContent, type PersonalPhotoResponse } from '../lib/api'
import { contentIcon } from '../lib/contentIcons'
import Skeleton from '../components/Skeleton'
import PhotoStrip from '../components/PhotoStrip'
import { useDocumentMeta } from '../lib/useDocumentMeta'

function NowSkeleton() {
  return (
    <div className="space-y-10">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-4 h-4 rounded" />
            <Skeleton className="h-5 w-40" />
          </div>
          <div className="space-y-2 pl-1">
            <Skeleton className="h-4 w-full max-w-lg" />
            <Skeleton className="h-4 w-3/4 max-w-md" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Fallback used only if the API is unreachable, so the page never renders blank.
const FALLBACK: NowContent = {
  last_updated: '',
  sections: [
    {
      icon: 'Hammer',
      title: 'Building',
      items: ['Growing this site into a consulting CRM — contracts, invoicing, and scheduling.'],
    },
  ],
}

export default function Now() {
  useDocumentMeta({
    title: 'Now — Nathan Blatter',
    description: "A snapshot of what has Nathan's attention at the moment — updated every so often.",
    canonical: '/now',
  })
  const [content, setContent] = useState<NowContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [photos, setPhotos] = useState<PersonalPhotoResponse[]>([])

  useEffect(() => {
    let cancelled = false
    api.siteContent.get<NowContent>('now')
      .then(res => { if (!cancelled) setContent(res.data) })
      .catch(() => { if (!cancelled) setContent(FALLBACK) })
      .finally(() => { if (!cancelled) setLoading(false) })
    api.personalPhotos.list('now')
      .catch(() => [] as PersonalPhotoResponse[])
      .then(p => { if (!cancelled) setPhotos(p) })
    return () => { cancelled = true }
  }, [])

  const sections = content?.sections ?? []

  return (
    <section className="py-16 md:py-24 min-h-screen">
      <div className="max-w-[720px] w-full mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <span className="font-mono text-xs text-blue tracking-[0.2em] uppercase">// NOW</span>
          <h1 className="font-serif text-4xl md:text-5xl italic text-ink mt-3 mb-4">
            What I'm doing now
          </h1>
          <p className="text-steel leading-relaxed max-w-lg">
            A snapshot of what has my attention at the moment — updated every so often.
          </p>
          {content?.last_updated && (
            <p className="font-mono text-xs text-silver mt-3">Last updated: {content.last_updated}</p>
          )}
        </motion.div>

        {loading ? (
          <NowSkeleton />
        ) : (
          <div className="space-y-10">
            {sections.map((section, i) => {
              const Icon = contentIcon(section.icon)
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={16} className="text-blue" />
                    <h2 className="font-sans font-semibold text-ink text-xl">{section.title}</h2>
                  </div>
                  <ul className="space-y-2 pl-1">
                    {section.items.map((item, j) => (
                      <li key={j} className="flex gap-3 text-steel leading-relaxed">
                        <span className="mt-1.5 shrink-0">
                          <span className="block w-1.5 h-1.5 rounded-full bg-blue/40" />
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )
            })}
          </div>
        )}

        {photos.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-14 space-y-3"
          >
            <h2 className="font-sans font-semibold text-ink text-xl">Lately</h2>
            <PhotoStrip photos={photos} size="sm" />
          </motion.div>
        )}

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-14 pt-8 border-t border-mist text-sm text-steel"
        >
          Want to work together or just say hi?{' '}
          <Link to="/contact" className="text-blue hover:underline">Get in touch</Link>.
        </motion.p>
      </div>
    </section>
  )
}
