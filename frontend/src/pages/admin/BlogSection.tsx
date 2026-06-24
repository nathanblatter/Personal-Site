import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import { Plus, Trash2, Save, Eye, Pencil, FileText, Globe, EyeOff } from 'lucide-react'
import { api, type BlogPostResponse } from '../../lib/api'
import { AdminInput, AdminTextarea, TagEditor, SectionCard, FileUploadButton, type AdminCallbacks } from './AdminShared'
import { useUnsavedWarning } from './useUnsavedWarning'

function slugify(title: string): string {
  return title.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-|-$/g, '')
}

interface BlogSectionProps extends AdminCallbacks {
  blogs: BlogPostResponse[]
  setBlogs: React.Dispatch<React.SetStateAction<BlogPostResponse[]>>
}

export default function BlogSection({ showToast, showError, blogs, setBlogs }: BlogSectionProps) {
  const [editingBlog, setEditingBlog] = useState<number | null>(null)
  const [blogDraft, setBlogDraft] = useState<Partial<BlogPostResponse>>({})
  const [showBlogPreview, setShowBlogPreview] = useState(false)
  useUnsavedWarning(editingBlog !== null)

  const openBlogEditor = (post: BlogPostResponse) => {
    setEditingBlog(post.id)
    setBlogDraft({ ...post })
    setShowBlogPreview(false)
  }

  const closeBlogEditor = () => {
    setEditingBlog(null)
    setBlogDraft({})
    setShowBlogPreview(false)
  }

  const updateBlogDraft = (field: keyof BlogPostResponse, value: unknown) => {
    setBlogDraft(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'title' && typeof value === 'string') {
        const currentSlug = prev.slug ?? ''
        const oldAuto = slugify(prev.title ?? '')
        if (!currentSlug || currentSlug === oldAuto) {
          next.slug = slugify(value)
        }
      }
      return next
    })
  }

  const saveBlog = async () => {
    if (!editingBlog || !blogDraft) return
    try {
      const updated = await api.blog.update(editingBlog, blogDraft)
      setBlogs(prev => prev.map(b => b.id === updated.id ? updated : b))
      closeBlogEditor()
      showToast('Post saved')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const addBlog = async () => {
    try {
      const created = await api.blog.create({
        slug: `post-${Date.now()}`,
        title: 'New Post',
        subtitle: '',
        content: '# New Post\n\nStart writing here…',
        excerpt: '',
        cover_image_url: '',
        tags: [],
        published: false,
        published_at: undefined,
      })
      setBlogs(prev => [created, ...prev])
      openBlogEditor(created)
      showToast('Post created')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  const deleteBlog = async (id: number) => {
    try {
      await api.blog.delete(id)
      setBlogs(prev => prev.filter(b => b.id !== id))
      if (editingBlog === id) closeBlogEditor()
      showToast('Post deleted')
    } catch (err) {
      showError((err as Error).message)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-sans font-semibold text-ink mb-1">Blog</h2>
          <p className="text-steel text-sm">{blogs.length} post{blogs.length !== 1 ? 's' : ''} · {blogs.filter(b => b.published).length} published</p>
        </div>
        <button
          onClick={addBlog}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors shadow-sm"
        >
          <Plus size={14} /> New Post
        </button>
      </div>

      <div className="space-y-3">
        {blogs.length === 0 && (
          <SectionCard>
            <p className="text-center text-steel text-sm py-8 font-mono">No posts yet. Click "New Post" to get started.</p>
          </SectionCard>
        )}

        {blogs.map(post => (
          <SectionCard key={post.id} className="!p-0 overflow-hidden">
            {/* Row */}
            <div
              className="flex items-center gap-4 p-5 cursor-pointer hover:bg-cloud/50 transition-colors"
              onClick={() => editingBlog === post.id ? closeBlogEditor() : openBlogEditor(post)}
            >
              <FileText size={15} className="text-steel shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-ink block truncate">{post.title}</span>
                <p className="text-xs text-silver font-mono mt-0.5 truncate">/{post.slug}</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 ${
                post.published ? 'bg-teal/10 text-teal' : 'bg-silver/20 text-steel'
              }`}>
                {post.published ? <><Globe size={10} /> Published</> : <><EyeOff size={10} /> Draft</>}
              </span>
              {post.published_at && (
                <span className="font-mono text-[11px] text-silver shrink-0 hidden md:block">
                  {new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={e => {
                    e.stopPropagation()
                    if (editingBlog === post.id) closeBlogEditor()
                    else openBlogEditor(post)
                  }}
                  className="p-1.5 text-steel hover:text-blue transition-colors"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); deleteBlog(post.id) }}
                  className="p-1.5 text-steel hover:text-ember transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Editor */}
            <AnimatePresence>
              {editingBlog === post.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-mist p-6 bg-white space-y-5">
                    {/* Title + Subtitle */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <AdminInput
                        label="Title"
                        value={blogDraft.title ?? ''}
                        onChange={v => updateBlogDraft('title', v)}
                      />
                      <AdminInput
                        label="Subtitle"
                        value={blogDraft.subtitle ?? ''}
                        onChange={v => updateBlogDraft('subtitle', v)}
                        placeholder="Optional tagline"
                      />
                    </div>

                    {/* Slug + Cover image */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <AdminInput
                        label="Slug"
                        value={blogDraft.slug ?? ''}
                        onChange={v => updateBlogDraft('slug', v)}
                        mono
                        placeholder="url-friendly-slug"
                      />
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="font-mono text-[11px] text-steel tracking-wider uppercase">Cover Image</label>
                          <FileUploadButton
                            prefix="blog/covers"
                            accept="image/*"
                            label="Upload"
                            onUploaded={url => updateBlogDraft('cover_image_url', url)}
                          />
                        </div>
                        <input
                          value={blogDraft.cover_image_url ?? ''}
                          onChange={e => updateBlogDraft('cover_image_url', e.target.value)}
                          placeholder="URL or upload an image →"
                          className="w-full px-3.5 py-2.5 bg-white border border-mist rounded-lg text-sm text-ink placeholder-silver focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all"
                        />
                        {blogDraft.cover_image_url && (
                          <img src={blogDraft.cover_image_url} alt="Cover preview" className="mt-2 h-20 rounded-lg object-cover border border-mist" />
                        )}
                      </div>
                    </div>

                    {/* Excerpt */}
                    <AdminTextarea
                      label="Excerpt"
                      value={blogDraft.excerpt ?? ''}
                      onChange={v => updateBlogDraft('excerpt', v)}
                      rows={2}
                    />

                    {/* Tags */}
                    <TagEditor
                      tags={blogDraft.tags ?? []}
                      onChange={tags => updateBlogDraft('tags', tags)}
                    />

                    {/* Content with preview toggle */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="font-mono text-[11px] text-steel tracking-wider uppercase">
                          Content (Markdown)
                        </label>
                        <div className="flex items-center gap-3">
                          <FileUploadButton
                            prefix="blog/images"
                            accept="image/*"
                            label="Insert Image"
                            onUploaded={url => {
                              const md = `\n![image](${url})\n`
                              updateBlogDraft('content', (blogDraft.content ?? '') + md)
                            }}
                          />
                          <FileUploadButton
                            prefix="blog/files"
                            label="Insert File"
                            onUploaded={(url, key) => {
                              const name = key.split('/').pop() || 'file'
                              const md = `\n[${name}](${url})\n`
                              updateBlogDraft('content', (blogDraft.content ?? '') + md)
                            }}
                          />
                          <button
                            onClick={() => setShowBlogPreview(v => !v)}
                            className="inline-flex items-center gap-1.5 font-mono text-[10px] text-steel hover:text-blue transition-colors"
                          >
                            {showBlogPreview ? <><Pencil size={11} /> Edit</> : <><Eye size={11} /> Preview</>}
                          </button>
                        </div>
                      </div>

                      {showBlogPreview ? (
                        <div className="w-full min-h-[320px] max-h-[600px] px-5 py-4 bg-cloud border border-mist rounded-lg text-sm text-ink overflow-y-auto">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkFrontmatter]}
                            components={{
                              h1: ({ children }) => <h1 className="text-xl font-bold text-ink mt-6 mb-3">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-lg font-semibold text-ink mt-5 mb-2">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-base font-semibold text-ink mt-4 mb-1.5">{children}</h3>,
                              p: ({ children }) => <p className="text-ink/80 leading-7 mb-4">{children}</p>,
                              strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
                              a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue hover:underline underline-offset-2">{children}</a>,
                              ul: ({ children }) => <ul className="list-disc pl-5 mb-4 space-y-1 text-ink/80">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal pl-5 mb-4 space-y-1 text-ink/80">{children}</ol>,
                              li: ({ children }) => <li className="leading-7">{children}</li>,
                              blockquote: ({ children }) => <blockquote className="border-l-4 border-blue/30 pl-4 my-4 text-steel italic">{children}</blockquote>,
                              pre: ({ children }) => <pre className="bg-[#1a1a2e] text-[#e2e8f0] p-4 rounded-lg overflow-x-auto my-4 text-xs leading-relaxed font-mono">{children}</pre>,
                              code: ({ className, children, ...props }) => {
                                if (className?.startsWith('language-')) return <code className={className} {...props}>{children}</code>
                                return <code className="font-mono text-xs bg-white text-blue px-1.5 py-0.5 rounded" {...props}>{children}</code>
                              },
                              hr: () => <hr className="border-mist my-6" />,
                              img: ({ src, alt }) => <img src={src} alt={alt} className="w-full rounded-lg my-4 border border-mist" />,
                              table: ({ children }) => <div className="overflow-x-auto my-4 rounded-lg border border-mist"><table className="w-full text-sm border-collapse">{children}</table></div>,
                              thead: ({ children }) => <thead className="bg-white">{children}</thead>,
                              th: ({ children }) => <th className="border-b border-mist px-3 py-2 font-mono text-[10px] text-steel uppercase tracking-wider text-left">{children}</th>,
                              td: ({ children }) => <td className="border-b border-mist/60 px-3 py-2 text-ink/80">{children}</td>,
                            }}
                          >
                            {blogDraft.content ?? ''}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <textarea
                          value={blogDraft.content ?? ''}
                          onChange={e => updateBlogDraft('content', e.target.value)}
                          rows={18}
                          placeholder="# Your Post Title&#10;&#10;Write your content in Markdown…"
                          className="w-full px-3.5 py-2.5 bg-white border border-mist rounded-lg text-sm text-ink placeholder-silver focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all resize-none font-mono leading-relaxed"
                        />
                      )}
                    </div>

                    {/* Published toggle + Save */}
                    <div className="flex items-center justify-between pt-2">
                      <label className="flex items-center gap-3 cursor-pointer select-none">
                        <button
                          role="switch"
                          aria-checked={blogDraft.published ?? false}
                          onClick={() => updateBlogDraft('published', !(blogDraft.published ?? false))}
                          className={`relative w-11 h-6 rounded-full transition-colors ${
                            blogDraft.published ? 'bg-teal' : 'bg-mist'
                          }`}
                        >
                          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            blogDraft.published ? 'translate-x-6' : 'translate-x-1'
                          }`} />
                        </button>
                        <span className="text-sm text-ink font-medium">
                          {blogDraft.published ? 'Published' : 'Draft'}
                        </span>
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={closeBlogEditor}
                          className="px-4 py-2.5 bg-cloud text-steel font-mono text-xs rounded-lg hover:bg-mist transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveBlog}
                          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors"
                        >
                          <Save size={13} /> Save Post
                        </button>
                      </div>
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
