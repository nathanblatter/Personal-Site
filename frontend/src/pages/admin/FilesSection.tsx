import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { Trash2, File, Download, Copy } from 'lucide-react'
import { api, type StorageFile } from '../../lib/api'
import { SectionCard, FileUploadButton, type AdminCallbacks } from './AdminShared'

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const isImageKey = (key: string) => /\.(jpg|jpeg|png|gif|webp|svg|avif)$/i.test(key)

export default function FilesSection({ showToast, showError }: AdminCallbacks) {
  const [files, setFiles] = useState<StorageFile[]>([])
  const [filesPrefix, setFilesPrefix] = useState('')

  useEffect(() => {
    api.storage.list(filesPrefix)
      .then(res => setFiles(res.files))
      .catch(err => showError((err as Error).message))
  }, [filesPrefix, showError])

  const refreshFiles = async (prefix = filesPrefix) => {
    try {
      const res = await api.storage.list(prefix)
      setFiles(res.files)
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const deleteFile = async (key: string) => {
    try {
      await api.storage.delete(key)
      setFiles(prev => prev.filter(f => f.key !== key))
      showToast('File deleted')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showToast('Copied to clipboard')
  }

  const prefixes = [...new Set(files.map(f => f.key.split('/').slice(0, -1).join('/')))]
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-sans font-semibold text-ink mb-1">Files</h2>
          <p className="text-steel text-sm">{files.length} file{files.length !== 1 ? 's' : ''} in storage</p>
        </div>
        <FileUploadButton
          prefix="uploads"
          label="Upload File"
          className="!px-4 !py-2.5 !bg-blue !text-white hover:!bg-blue-dim !font-semibold"
          onUploaded={() => refreshFiles()}
        />
      </div>

      {/* Folder filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilesPrefix('')}
          className={`font-mono text-[11px] px-3 py-1.5 rounded-full transition-all ${!filesPrefix ? 'bg-blue-wash text-blue' : 'bg-cloud text-steel hover:text-ink'}`}
        >
          All
        </button>
        {prefixes.map(p => (
          <button
            key={p}
            onClick={() => setFilesPrefix(p)}
            className={`font-mono text-[11px] px-3 py-1.5 rounded-full transition-all ${filesPrefix === p ? 'bg-blue-wash text-blue' : 'bg-cloud text-steel hover:text-ink'}`}
          >
            {p || 'root'}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {files.length === 0 && (
          <SectionCard>
            <p className="text-center text-steel text-sm py-8 font-mono">No files uploaded yet.</p>
          </SectionCard>
        )}
        {files.map(file => {
          const url = api.storage.downloadUrl(file.key)
          const fileName = file.key.split('/').pop() || file.key
          const folder = file.key.split('/').slice(0, -1).join('/')
          return (
            <SectionCard key={file.key} className="!p-4">
              <div className="flex items-center gap-4">
                {/* Thumbnail or icon */}
                {isImageKey(file.key) ? (
                  <img src={url} alt={fileName} className="w-12 h-12 rounded-lg object-cover border border-mist shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-cloud border border-mist flex items-center justify-center shrink-0">
                    <File size={18} className="text-steel" />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-ink block truncate">{fileName}</span>
                  <div className="flex items-center gap-3 mt-0.5">
                    {folder && <span className="font-mono text-[10px] text-silver">{folder}/</span>}
                    <span className="font-mono text-[10px] text-silver">{formatFileSize(file.size)}</span>
                    <span className="font-mono text-[10px] text-silver">
                      {new Date(file.last_modified).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => copyToClipboard(url)}
                    className="p-2 text-steel hover:text-blue transition-colors"
                    title="Copy URL"
                  >
                    <Copy size={13} />
                  </button>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-steel hover:text-blue transition-colors"
                    title="Download"
                  >
                    <Download size={13} />
                  </a>
                  <button
                    onClick={() => deleteFile(file.key)}
                    className="p-2 text-steel hover:text-ember transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </SectionCard>
          )
        })}
      </div>
    </motion.div>
  )
}
