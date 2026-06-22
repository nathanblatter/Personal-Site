import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Plus, Trash2, GripVertical, Save, X, Pencil, ExternalLink } from 'lucide-react'
import { api, type ProjectResponse } from '../../lib/api'
import { AdminInput, AdminTextarea, AdminSelect, TagEditor, StatusBadge, SectionCard, FileUploadButton, type AdminCallbacks } from './AdminShared'
import { useUnsavedWarning } from './useUnsavedWarning'
import { useDragReorder } from './useDragReorder'

interface ProjectsSectionProps extends AdminCallbacks {
  projects: ProjectResponse[]
  setProjects: React.Dispatch<React.SetStateAction<ProjectResponse[]>>
}

export default function ProjectsSection({ showToast, showError, projects, setProjects }: ProjectsSectionProps) {
  const [editingProject, setEditingProject] = useState<number | null>(null)
  useUnsavedWarning(editingProject !== null)

  const updateProjectLocal = (id: number, field: string, value: unknown) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  const { dragHandleProps, dropTargetProps, overId } = useDragReorder(projects, async (next) => {
    const reindexed = next.map((p, i) => ({ ...p, sort_order: i }))
    const changed = reindexed.filter(p => projects.find(o => o.id === p.id)?.sort_order !== p.sort_order)
    setProjects(reindexed)
    try {
      await Promise.all(changed.map(p => api.projects.update(p.id, { sort_order: p.sort_order })))
    } catch (err) {
      showError((err as Error).message)
    }
  })

  const saveProject = async (project: ProjectResponse) => {
    try {
      const updated = await api.projects.update(project.id, project)
      setProjects(prev => prev.map(p => p.id === updated.id ? updated : p))
      setEditingProject(null)
      showToast('Project updated')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const addProject = async () => {
    try {
      const created = await api.projects.create({
        project_id: `project-${Date.now()}`,
        title: 'New Project',
        description: '',
        tags: [],
        year: '2026',
        color: '#3b6cf5',
        status: 'wip',
        link: '',
        images: [],
        metrics: [],
        sort_order: projects.length,
      })
      setProjects(prev => [created, ...prev])
      setEditingProject(created.id)
      showToast('Project created')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const deleteProject = (id: number) => {
    const idx = projects.findIndex(p => p.id === id)
    const removed = projects[idx]
    if (!removed) return
    setProjects(prev => prev.filter(p => p.id !== id))
    if (editingProject === id) setEditingProject(null)
    let undone = false
    const timer = setTimeout(async () => {
      if (undone) return
      try { await api.projects.delete(id) } catch (err) {
        setProjects(prev => [...prev.slice(0, idx), removed, ...prev.slice(idx)])
        showError((err as Error).message)
      }
    }, 5000)
    showToast('Project deleted', {
      label: 'Undo',
      onClick: () => { undone = true; clearTimeout(timer); setProjects(prev => [...prev.slice(0, idx), removed, ...prev.slice(idx)]) },
    })
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-sans font-semibold text-ink mb-1">Projects</h2>
          <p className="text-steel text-sm">{projects.length} total — {projects.filter(p => p.status === 'live').length} live, {projects.filter(p => p.status === 'wip').length} WIP</p>
        </div>
        <button onClick={addProject} className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors shadow-sm">
          <Plus size={14} /> Add Project
        </button>
      </div>

      <div className="space-y-3">
        {projects.map(project => (
          <SectionCard key={project.id} {...dropTargetProps(project.id)} className={`!p-0 overflow-hidden ${overId === project.id ? 'ring-2 ring-blue/30' : ''}`}>
            <div
              className="flex items-center gap-4 p-5 cursor-pointer hover:bg-cloud/50 transition-colors"
              onClick={() => setEditingProject(editingProject === project.id ? null : project.id)}
            >
              <span
                {...dragHandleProps(project.id)}
                onClick={e => e.stopPropagation()}
                className="cursor-grab active:cursor-grabbing text-silver hover:text-steel"
                title="Drag to reorder"
              >
                <GripVertical size={14} />
              </span>
              <div className="w-4 h-4 rounded-md border border-mist" style={{ background: project.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-ink truncate">{project.title}</span>
                  <StatusBadge status={project.status} />
                </div>
                <p className="text-xs text-steel truncate mt-0.5">{project.description}</p>
              </div>
              <span className="font-mono text-xs text-silver shrink-0">{project.year}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                {project.link && (
                  <a href={project.link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="p-1.5 text-steel hover:text-blue transition-colors">
                    <ExternalLink size={13} />
                  </a>
                )}
                <button onClick={e => { e.stopPropagation(); setEditingProject(editingProject === project.id ? null : project.id) }} className="p-1.5 text-steel hover:text-blue transition-colors">
                  <Pencil size={13} />
                </button>
                <button onClick={e => { e.stopPropagation(); deleteProject(project.id) }} className="p-1.5 text-steel hover:text-ember transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            <AnimatePresence>
              {editingProject === project.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-mist p-6 bg-white space-y-5">
                    <div className="grid grid-cols-2 gap-5">
                      <AdminInput label="Title" value={project.title} onChange={v => updateProjectLocal(project.id, 'title', v)} />
                      <AdminInput label="Year" value={project.year} onChange={v => updateProjectLocal(project.id, 'year', v)} mono />
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <AdminInput label="Slug (project_id)" value={project.project_id} onChange={v => updateProjectLocal(project.id, 'project_id', v)} mono placeholder="my-project-slug" />
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="font-mono text-[11px] text-steel tracking-wider uppercase">Link / Document URL</label>
                          <FileUploadButton
                            prefix="projects/docs"
                            label="Upload Doc"
                            onUploaded={url => updateProjectLocal(project.id, 'link', url)}
                          />
                        </div>
                        <input
                          value={project.link || ''}
                          onChange={e => updateProjectLocal(project.id, 'link', e.target.value)}
                          placeholder="https://… or upload a document →"
                          className="w-full px-3.5 py-2.5 bg-white border border-mist rounded-lg text-xs text-ink font-mono placeholder-silver focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all"
                        />
                      </div>
                    </div>
                    <AdminTextarea label="Description" value={project.description} onChange={v => updateProjectLocal(project.id, 'description', v)} />

                    {/* Screenshots */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="font-mono text-[11px] text-steel tracking-wider uppercase">Screenshots</label>
                        <FileUploadButton
                          prefix={`projects/images/${project.project_id}`}
                          accept="image/*"
                          label="Add Image"
                          onUploaded={url => updateProjectLocal(project.id, 'images', [...(project.images || []), url])}
                        />
                      </div>
                      {(project.images?.length ?? 0) > 0 ? (
                        <div className="flex gap-3 overflow-x-auto pb-2">
                          {project.images!.map((img, i) => (
                            <div key={i} className="relative shrink-0 group">
                              <img src={img} alt={`Screenshot ${i + 1}`} className="h-24 w-36 rounded-lg object-cover border border-mist" />
                              <button
                                onClick={() => updateProjectLocal(project.id, 'images', project.images!.filter((_, j) => j !== i))}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-ember text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-silver font-mono py-3">No screenshots yet. Upload images to show in the project modal.</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <AdminSelect
                        label="Status"
                        value={project.status}
                        onChange={v => updateProjectLocal(project.id, 'status', v)}
                        options={[
                          { value: 'live', label: 'Live' },
                          { value: 'wip', label: 'WIP' },
                          { value: 'archived', label: 'Archived' },
                        ]}
                      />
                      <div>
                        <label className="block font-mono text-[11px] text-steel mb-1.5 tracking-wider uppercase">Color</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={project.color}
                            onChange={e => updateProjectLocal(project.id, 'color', e.target.value)}
                            className="w-10 h-10 rounded-lg border border-mist cursor-pointer"
                          />
                          <input
                            value={project.color}
                            onChange={e => updateProjectLocal(project.id, 'color', e.target.value)}
                            className="flex-1 px-3 py-2.5 bg-white border border-mist rounded-lg text-xs text-ink font-mono focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all"
                          />
                        </div>
                      </div>
                    </div>
                    <TagEditor tags={project.tags} onChange={tags => updateProjectLocal(project.id, 'tags', tags)} />

                    {/* Metrics */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="font-mono text-[11px] text-steel tracking-wider uppercase">Metrics</label>
                        <button
                          onClick={() => updateProjectLocal(project.id, 'metrics', [...(project.metrics || []), { label: '', value: '' }])}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono text-blue bg-blue-wash rounded-lg hover:bg-blue/10 transition-colors"
                        >
                          <Plus size={10} /> Add
                        </button>
                      </div>
                      {(project.metrics?.length ?? 0) > 0 ? (
                        <div className="space-y-2">
                          {project.metrics!.map((m, mi) => (
                            <div key={mi} className="flex items-center gap-2">
                              <input
                                value={m.value}
                                onChange={e => {
                                  const next = [...project.metrics!]
                                  next[mi] = { ...next[mi], value: e.target.value }
                                  updateProjectLocal(project.id, 'metrics', next)
                                }}
                                placeholder="200+"
                                className="w-24 px-2.5 py-2 bg-white border border-mist rounded-lg text-xs text-ink font-semibold focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all text-center"
                              />
                              <input
                                value={m.label}
                                onChange={e => {
                                  const next = [...project.metrics!]
                                  next[mi] = { ...next[mi], label: e.target.value }
                                  updateProjectLocal(project.id, 'metrics', next)
                                }}
                                placeholder="dev hours"
                                className="flex-1 px-2.5 py-2 bg-white border border-mist rounded-lg text-xs text-ink font-mono focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all"
                              />
                              <button
                                onClick={() => updateProjectLocal(project.id, 'metrics', project.metrics!.filter((_, j) => j !== mi))}
                                className="p-1.5 text-steel hover:text-ember transition-colors"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-silver font-mono py-2">No metrics. Add stats like "200+ dev hours" or "1,000 users".</p>
                      )}
                    </div>

                    <div className="flex justify-end pt-2">
                      <button onClick={() => saveProject(project)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors">
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
