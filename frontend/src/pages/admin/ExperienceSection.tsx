import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Plus, Trash2, GripVertical, Save, Pencil } from 'lucide-react'
import { api, type ExperienceResponse } from '../../lib/api'
import { AdminInput, AdminTextarea, SectionCard, type AdminCallbacks } from './AdminShared'
import { useUnsavedWarning } from './useUnsavedWarning'

interface ExperienceSectionProps extends AdminCallbacks {
  experience: ExperienceResponse[]
  setExperience: React.Dispatch<React.SetStateAction<ExperienceResponse[]>>
}

export default function ExperienceSection({ showToast, showError, experience, setExperience }: ExperienceSectionProps) {
  const [editingExp, setEditingExp] = useState<number | null>(null)
  useUnsavedWarning(editingExp !== null)

  const updateExpLocal = (id: number, field: string, value: unknown) => {
    setExperience(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e))
  }

  const saveExp = async (exp: ExperienceResponse) => {
    try {
      const updated = await api.experience.update(exp.id, exp)
      setExperience(prev => prev.map(e => e.id === updated.id ? updated : e))
      setEditingExp(null)
      showToast('Experience updated')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const addExp = async () => {
    try {
      const created = await api.experience.create({
        year: '2026 — Present',
        title: 'New Position',
        subtitle: 'Company',
        description: '',
        active: false,
        sort_order: experience.length,
      })
      setExperience(prev => [...prev, created])
      setEditingExp(created.id)
      showToast('Experience added')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const deleteExp = async (id: number) => {
    try {
      await api.experience.delete(id)
      setExperience(prev => prev.filter(e => e.id !== id))
      if (editingExp === id) setEditingExp(null)
      showToast('Experience removed')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-sans font-semibold text-ink mb-1">Experience</h2>
          <p className="text-steel text-sm">{experience.length} entries — {experience.filter(e => e.active).length} currently active</p>
        </div>
        <button onClick={addExp} className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors shadow-sm">
          <Plus size={14} /> Add Entry
        </button>
      </div>

      <div className="space-y-3">
        {experience.map(exp => (
          <SectionCard key={exp.id} className="!p-0 overflow-hidden">
            <div
              className="flex items-center gap-4 p-5 cursor-pointer hover:bg-cloud/50 transition-colors"
              onClick={() => setEditingExp(editingExp === exp.id ? null : exp.id)}
            >
              <GripVertical size={14} className="text-silver" />
              <div className={`w-3 h-3 rounded-full border-2 ${exp.active ? 'bg-blue border-blue' : 'bg-white border-silver'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-ink">{exp.title}</span>
                  {exp.active && <span className="font-mono text-[10px] text-teal bg-teal/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Active</span>}
                </div>
                <p className="text-xs text-steel mt-0.5">{exp.subtitle}</p>
              </div>
              <span className="font-mono text-xs text-silver shrink-0">{exp.year}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={e => { e.stopPropagation(); setEditingExp(editingExp === exp.id ? null : exp.id) }} className="p-1.5 text-steel hover:text-blue transition-colors">
                  <Pencil size={13} />
                </button>
                <button onClick={e => { e.stopPropagation(); deleteExp(exp.id) }} className="p-1.5 text-steel hover:text-ember transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            <AnimatePresence>
              {editingExp === exp.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-mist p-6 bg-white space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <AdminInput label="Title" value={exp.title} onChange={v => updateExpLocal(exp.id, 'title', v)} />
                      <AdminInput label="Date Range" value={exp.year} onChange={v => updateExpLocal(exp.id, 'year', v)} mono />
                    </div>
                    <AdminInput label="Organization" value={exp.subtitle} onChange={v => updateExpLocal(exp.id, 'subtitle', v)} />
                    <AdminTextarea label="Description" value={exp.description} onChange={v => updateExpLocal(exp.id, 'description', v)} />
                    <div className="flex items-center gap-3">
                      <label className="font-mono text-[11px] text-steel tracking-wider uppercase">Currently Active</label>
                      <button
                        onClick={() => updateExpLocal(exp.id, 'active', !exp.active)}
                        className={`relative w-11 h-6 rounded-full transition-colors ${exp.active ? 'bg-blue' : 'bg-silver'}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${exp.active ? 'left-6' : 'left-1'}`} />
                      </button>
                    </div>
                    <div className="flex justify-end pt-2">
                      <button onClick={() => saveExp(exp)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors">
                        <Save size={13} /> Save Changes
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </SectionCard>
        ))}
      </div>
    </motion.div>
  )
}
