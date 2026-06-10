import { useState } from 'react'
import { motion } from 'motion/react'
import { Plus, X } from 'lucide-react'
import { api, type CourseworkResponse } from '../../lib/api'
import { SectionCard, type AdminCallbacks } from './AdminShared'

interface CourseworkSectionProps extends AdminCallbacks {
  coursework: CourseworkResponse[]
  setCoursework: React.Dispatch<React.SetStateAction<CourseworkResponse[]>>
}

export default function CourseworkSection({ showToast, showError, coursework, setCoursework }: CourseworkSectionProps) {
  const [newCourseName, setNewCourseName] = useState('')
  const [addingCourse, setAddingCourse] = useState(false)

  const addCourse = async () => {
    const name = newCourseName.trim()
    if (!name) return
    try {
      const created = await api.coursework.create({ name, sort_order: coursework.length })
      setCoursework(prev => [...prev, created])
      setNewCourseName('')
      setAddingCourse(false)
      showToast('Course added')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const deleteCourse = async (id: number) => {
    try {
      await api.coursework.delete(id)
      setCoursework(prev => prev.filter(c => c.id !== id))
      showToast('Course removed')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-sans font-semibold text-ink mb-1">Coursework</h2>
          <p className="text-steel text-sm">{coursework.length} courses listed</p>
        </div>
        <button onClick={() => setAddingCourse(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors shadow-sm">
          <Plus size={14} /> Add Course
        </button>
      </div>

      {addingCourse && (
        <SectionCard>
          <div className="flex items-center gap-3">
            <input
              autoFocus
              value={newCourseName}
              onChange={e => setNewCourseName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCourse()}
              placeholder="Course name…"
              className="flex-1 px-3.5 py-2.5 bg-white border border-mist rounded-lg text-sm text-ink placeholder-silver focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all"
            />
            <button onClick={addCourse} className="px-4 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors">
              Add
            </button>
            <button onClick={() => { setAddingCourse(false); setNewCourseName('') }} className="px-4 py-2.5 bg-cloud text-steel font-mono text-xs rounded-lg hover:bg-mist transition-colors">
              Cancel
            </button>
          </div>
        </SectionCard>
      )}

      <SectionCard>
        <div className="flex flex-wrap gap-2.5">
          {coursework.map(course => (
            <span key={course.id} className="group inline-flex items-center gap-2 font-mono text-sm px-4 py-2.5 rounded-xl border border-mist bg-white text-ink hover:border-blue/30 transition-all">
              {course.name}
              <button onClick={() => deleteCourse(course.id)} className="text-silver hover:text-ember opacity-0 group-hover:opacity-100 transition-all">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      </SectionCard>
    </motion.div>
  )
}
