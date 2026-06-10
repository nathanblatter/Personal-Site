import { useState } from 'react'
import { motion } from 'motion/react'
import { X, Check, Upload, Loader2, ChevronDown } from 'lucide-react'
import { api } from '../../lib/api'

export interface AdminCallbacks {
  showToast: (msg: string) => void
  showError: (msg: string) => void
}

export function AdminInput({ label, value, onChange, type = 'text', mono = false, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; mono?: boolean; placeholder?: string
}) {
  return (
    <div>
      <label className="block font-mono text-[11px] text-steel mb-1.5 tracking-wider uppercase">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3.5 py-2.5 bg-white border border-mist rounded-lg text-sm text-ink placeholder-silver focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all ${mono ? 'font-mono text-xs' : ''}`}
      />
    </div>
  )
}

export function AdminTextarea({ label, value, onChange, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number
}) {
  return (
    <div>
      <label className="block font-mono text-[11px] text-steel mb-1.5 tracking-wider uppercase">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full px-3.5 py-2.5 bg-white border border-mist rounded-lg text-sm text-ink placeholder-silver focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all resize-none"
      />
    </div>
  )
}

export function AdminSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className="block font-mono text-[11px] text-steel mb-1.5 tracking-wider uppercase">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none px-3.5 py-2.5 bg-white border border-mist rounded-lg text-sm text-ink focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all pr-10"
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-steel pointer-events-none" />
      </div>
    </div>
  )
}

export function TagEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState('')
  const add = () => {
    const t = input.trim()
    if (t && !tags.includes(t)) { onChange([...tags, t]); setInput('') }
  }
  return (
    <div>
      <label className="block font-mono text-[11px] text-steel mb-1.5 tracking-wider uppercase">Tags</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1.5 font-mono text-[11px] px-2.5 py-1 rounded-full bg-blue-wash text-blue">
            {tag}
            <button onClick={() => onChange(tags.filter(t => t !== tag))} className="hover:text-ember transition-colors">
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="Add tag…"
          className="flex-1 px-3 py-2 bg-white border border-mist rounded-lg text-sm text-ink placeholder-silver focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all font-mono text-xs"
        />
        <button onClick={add} className="px-3 py-2 bg-cloud text-steel rounded-lg hover:bg-blue-wash hover:text-blue transition-all text-xs font-mono">
          Add
        </button>
      </div>
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    live: 'bg-teal/10 text-teal',
    wip: 'bg-blue/10 text-blue',
    archived: 'bg-silver/30 text-steel',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider ${colors[status] || colors.archived}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'live' ? 'bg-teal' : status === 'wip' ? 'bg-blue' : 'bg-silver'}`} />
      {status}
    </span>
  )
}

export function VisibilityToggle({ value = 'show', onChange }: { value?: string; onChange: (v: string) => void }) {
  const opts = [
    { key: 'show', active: 'bg-steel/80 text-white' },
    { key: 'highlight', active: 'bg-blue text-white' },
    { key: 'hide', active: 'bg-ember/15 text-ember' },
  ]
  return (
    <div className="inline-flex rounded-lg border border-mist overflow-hidden shrink-0">
      {opts.map(({ key, active }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-2.5 py-1 font-mono text-[9px] uppercase tracking-wide transition-colors border-r border-mist last:border-r-0 ${value === key ? active : 'text-silver hover:text-steel hover:bg-cloud'}`}
        >
          {key}
        </button>
      ))}
    </div>
  )
}

export function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-snow border border-mist rounded-xl p-6 ${className}`}>
      {children}
    </div>
  )
}

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 bg-ink text-white rounded-xl shadow-xl shadow-ink/20"
    >
      <Check size={16} className="text-teal" />
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="text-steel hover:text-white transition-colors ml-2"><X size={14} /></button>
    </motion.div>
  )
}

export function FileUploadButton({ prefix, onUploaded, label, accept, className = '' }: {
  prefix: string
  onUploaded: (url: string, key: string) => void
  label?: string
  accept?: string
  className?: string
}) {
  const [uploading, setUploading] = useState(false)
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const result = await api.storage.upload(file, prefix)
      const url = api.storage.downloadUrl(result.key)
      onUploaded(url, result.key)
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }
  return (
    <label className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg cursor-pointer transition-all text-xs font-mono ${uploading ? 'bg-mist text-silver cursor-wait' : 'bg-cloud text-steel hover:bg-blue-wash hover:text-blue'} ${className}`}>
      {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
      {label || 'Upload'}
      <input type="file" accept={accept} onChange={handleFile} className="hidden" disabled={uploading} />
    </label>
  )
}
