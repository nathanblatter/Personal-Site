import { motion } from 'motion/react'
import type { PersonalPhotoResponse } from '../lib/api'

// Horizontal snap-scrolling strip of candid photo cards with a subtle
// alternating polaroid tilt. Shared between /about ("Off the clock") and
// /now ("Lately").
export default function PhotoStrip({ photos, size = 'md' }: {
  photos: PersonalPhotoResponse[]
  size?: 'md' | 'sm'
}) {
  if (photos.length === 0) return null
  const imgHeight = size === 'sm' ? 'h-36 md:h-40' : 'h-44 md:h-52'

  return (
    <div className="overflow-x-auto snap-x snap-mandatory -mx-6 px-6">
      <div className="flex gap-5 md:gap-6 w-max py-4">
        {photos.map((photo, i) => (
          <motion.figure
            key={photo.id}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: Math.min(i * 0.06, 0.3) }}
            className={`snap-start shrink-0 p-2.5 pb-2 rounded-xl border border-mist bg-white shadow-sm hover:shadow-md ${i % 2 === 0 ? 'rotate-1' : '-rotate-1'} hover:rotate-0 transition-all duration-300`}
          >
            <img
              src={photo.image_url}
              alt={photo.caption || 'Personal photo'}
              loading="lazy"
              decoding="async"
              className={`${imgHeight} w-auto max-w-[70vw] rounded-lg object-cover`}
              onError={(e) => {
                const fig = (e.currentTarget as HTMLImageElement).closest('figure')
                if (fig) (fig as HTMLElement).style.display = 'none'
              }}
            />
            {photo.caption && (
              <figcaption className="font-mono text-xs text-steel mt-2 px-0.5 max-w-[240px] leading-snug">
                {photo.caption}
              </figcaption>
            )}
          </motion.figure>
        ))}
      </div>
    </div>
  )
}
