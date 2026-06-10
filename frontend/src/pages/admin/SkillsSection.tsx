import { motion } from 'motion/react'
import { Plus, Trash2, Save } from 'lucide-react'
import { api, type SkillResponse } from '../../lib/api'
import { SectionCard, type AdminCallbacks } from './AdminShared'

interface SkillsSectionProps extends AdminCallbacks {
  skills: SkillResponse[]
  setSkills: React.Dispatch<React.SetStateAction<SkillResponse[]>>
}

export default function SkillsSection({ showToast, showError, skills, setSkills }: SkillsSectionProps) {
  const updateSkillLocal = (id: number, field: string, value: unknown) => {
    setSkills(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  const saveAllSkills = async () => {
    try {
      await Promise.all(skills.map(s => api.skills.update(s.id, s)))
      showToast('Skills saved')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const addSkill = async () => {
    try {
      const created = await api.skills.create({ name: 'New Skill', level: 50, category: 'Lang', sort_order: skills.length })
      setSkills(prev => [...prev, created])
      showToast('Skill added')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const deleteSkill = async (id: number) => {
    try {
      await api.skills.delete(id)
      setSkills(prev => prev.filter(s => s.id !== id))
      showToast('Skill removed')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-sans font-semibold text-ink mb-1">Skills</h2>
          <p className="text-steel text-sm">{skills.length} skills across {new Set(skills.map(s => s.category)).size} categories</p>
        </div>
        <button onClick={addSkill} className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors shadow-sm">
          <Plus size={14} /> Add Skill
        </button>
      </div>

      <SectionCard className="!p-0 overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-0 text-[11px] font-mono text-steel tracking-wider uppercase px-6 py-3 border-b border-mist bg-cloud/50">
          <span>Skill</span>
          <span className="w-20 text-center">Category</span>
          <span className="w-28 text-center">Level</span>
          <span className="w-16"></span>
        </div>
        {skills.map(skill => (
          <div key={skill.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-0 items-center px-6 py-3.5 border-b border-mist last:border-b-0 hover:bg-cloud/30 transition-colors">
            <input
              value={skill.name}
              onChange={e => updateSkillLocal(skill.id, 'name', e.target.value)}
              className="text-sm text-ink bg-transparent focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue/10 rounded px-2 py-1 -ml-2 transition-all"
            />
            <div className="w-20">
              <select
                value={skill.category}
                onChange={e => updateSkillLocal(skill.id, 'category', e.target.value)}
                className="appearance-none font-mono text-[11px] text-steel bg-transparent focus:outline-none focus:bg-white rounded px-2 py-1 text-center cursor-pointer"
              >
                {['Web', 'Lang', 'Data', 'Front', 'Back', 'Cloud', 'BI', 'IS'].map(c =>
                  <option key={c} value={c}>{c}</option>
                )}
              </select>
            </div>
            <div className="w-28 flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                value={skill.level}
                onChange={e => updateSkillLocal(skill.id, 'level', parseInt(e.target.value))}
                className="w-16 accent-blue"
              />
              <span className="font-mono text-xs text-steel w-8 text-right">{skill.level}%</span>
            </div>
            <div className="w-16 flex justify-end">
              <button onClick={() => deleteSkill(skill.id)} className="p-1.5 text-silver hover:text-ember transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </SectionCard>

      <div className="flex justify-end">
        <button onClick={saveAllSkills} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors">
          <Save size={13} /> Save All
        </button>
      </div>
    </motion.div>
  )
}
