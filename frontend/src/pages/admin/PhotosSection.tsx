import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Trash2, GripVertical, Save, Loader2, Image as ImageIcon } from 'lucide-react'
import { api, type PersonalPhotoResponse } from '../../lib/api'
import { SectionCard, FileUploadButton, type AdminCallbacks } from './AdminShared'
import { useUnsavedWarning } from './useUnsavedWarning'
import { useDragReorder } from './useDragReorder'

const CONTEXTS = [
  { value: 'about', label: 'About — "Off the clock"' },
  { value: 'now', label: 'Now — "Lately"' },
]

export default function PhotosSection({ showToast, showError }: AdminCallbacks) {
  const [loading, setLoading] = useState(true)
  const [photos, setPhotos] = useState<PersonalPhotoResponse[]>([])
  const [dirtyIds, setDirtyIds] = useState<Set<number>>(new Set())
  useUnsavedWarning(dirtyIds.size > 0)

  useEffect(() => {
    api.personalPhotos.list()
      .then(setPhotos)
      .catch(err => showError((err as Error).message))
      .finally(() => setLoading(false))
  }, [showError])

  const drag = useDragReorder(photos, async (next) => {
    const reindexed = next.map((x, i) => ({ ...x, sort_order: i }))
    const changed = reindexed.filter(x => photos.find(p => p.id === x.id)?.sort_order !== x.sort_order)
    setPhotos(reindexed)
    try { await Promise.all(changed.map(x => api.personalPhotos.update(x.id, { sort_order: x.sort_order }))) }
    catch (err) { showError((err as Error).message) }
  })

  const setPhotoLocal = (id: number, field: keyof PersonalPhotoResponse, value: unknown) => {
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
    setDirtyIds(prev => new Set(prev).add(id))
  }

  const addPhoto = async (url: string, key: string) => {
    try {
      const created = await api.personalPhotos.create({
        image_url: url, image_key: key, caption: '', context: 'about', sort_order: photos.length,
      })
      setPhotos(prev => [...prev, created])
      showToast('Photo added')
    } catch (err) { showError((err as Error).message) }
  }

  const savePhoto = async (photo: PersonalPhotoResponse) => {
    try {
      const updated = await api.personalPhotos.update(photo.id, {
        image_url: photo.image_url, image_key: photo.image_key,
        caption: photo.caption ?? '', context: photo.context, sort_order: photo.sort_order,
      })
      setPhotos(prev => prev.map(p => p.id === updated.id ? updated : p))
      setDirtyIds(prev => { const next = new Set(prev); next.delete(photo.id); return next })
      showToast('Photo saved')
    } catch (err) { showError((err as Error).message) }
  }

  const deletePhoto = async (id: number) => {
    try {
      await api.personalPhotos.delete(id)
      setPhotos(prev => prev.filter(p => p.id !== id))
      setDirtyIds(prev => { const next = new Set(prev); next.delete(id); return next })
      showToast('Photo removed')
    } catch (err) { showError((err as Error).message) }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-steel py-20 justify-center">
        <Loader2 size={20} className="animate-spin text-blue" />
        <span className="font-mono text-sm">Loading photos…</span>
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div>
        <h2 className="text-2xl font-sans font-semibold text-ink mb-1">Photos</h2>
        <p className="text-steel text-sm">Personal photos for the About ("Off the clock") and Now ("Lately") pages. EXIF is stripped on upload.</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-mono text-xs tracking-wider uppercase text-steel">Photos ({photos.length})</h3>
          <FileUploadButton
            prefix="personal-photos"
            label="Upload Photo"
            accept="image/*"
            onUploaded={addPhoto}
          />
        </div>
        <div className="space-y-3">
          {photos.map(photo => (
            <SectionCard key={photo.id} {...drag.dropTargetProps(photo.id)} className={`!p-0 overflow-hidden ${drag.overId === photo.id ? 'ring-2 ring-blue/30' : ''}`}>
              <div className="flex items-center gap-3 px-4 py-3">
                <span {...drag.dragHandleProps(photo.id)} className="cursor-grab text-silver hover:text-steel shrink-0" title="Drag to reorder"><GripVertical size={14} /></span>
                <div className="w-14 h-14 rounded-lg bg-cloud border border-mist overflow-hidden flex items-center justify-center shrink-0">
                  {photo.image_url
                    ? <img src={photo.image_url} alt={photo.caption || 'Photo'} loading="lazy" decoding="async" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                    : <ImageIcon size={18} className="text-silver" />}
                </div>
                <input
                  value={photo.caption ?? ''}
                  onChange={e => setPhotoLocal(photo.id, 'caption', e.target.value)}
                  className="flex-1 min-w-0 text-sm text-ink bg-transparent focus:outline-none focus:bg-snow focus:ring-2 focus:ring-blue/10 rounded px-2 py-1.5 transition-all border border-mist"
                  placeholder="Caption (optional)"
                />
                <select
                  value={photo.context}
                  onChange={e => setPhotoLocal(photo.id, 'context', e.target.value)}
                  className="shrink-0 text-xs font-mono text-steel bg-white border border-mist rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-blue/20"
                >
                  {CONTEXTS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <button
                  onClick={() => savePhoto(photo)}
                  disabled={!dirtyIds.has(photo.id)}
                  className="p-1.5 text-steel hover:text-blue transition-colors disabled:opacity-30 shrink-0"
                  title="Save"
                >
                  <Save size={13} />
                </button>
                <button onClick={() => deletePhoto(photo.id)} className="p-1.5 text-silver hover:text-ember transition-colors shrink-0" title="Delete">
                  <Trash2 size={13} />
                </button>
              </div>
            </SectionCard>
          ))}
          {photos.length === 0 && (
            <p className="text-center text-steel text-sm py-4 font-mono">No photos yet. Upload one above.</p>
          )}
        </div>
      </div>
    </motion.div>
  )
}
