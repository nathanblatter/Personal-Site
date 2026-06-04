import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft, Calendar, Clock, Eye, Link2, Check } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import remarkEmoji from 'remark-emoji'
import remarkMath from 'remark-math'
import rehypeRaw from 'rehype-raw'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { api, type BlogPostResponse } from '../lib/api'

function readTime(content: string): number {
  return Math.max(1, Math.round(content.trim().split(/\s+/).length / 200))
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function textContent(node: unknown): string {
  const n = node as { type?: string; value?: string; children?: unknown[] }
  if (n.type === 'text') return n.value ?? ''
  if (n.children) return n.children.map(textContent).join('')
  return ''
}

function headingId(node: unknown): string {
  return textContent(node)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/^-|-$/g, '')
}

interface TocItem { id: string; text: string; level: number }

function extractHeadings(content: string): TocItem[] {
  return content.split('\n').flatMap(line => {
    const m = line.match(/^(#{2,3})\s+(.+)$/)
    if (!m) return []
    const text = m[2].replace(/[*`_~]/g, '').trim()
    const id = text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/^-|-$/g, '')
    return [{ id, text, level: m[1].length }]
  })
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>()
  const [post, setPost] = useState<BlogPostResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [activeId, setActiveId] = useState<string>('')
  const headingsRef = useRef<TocItem[]>([])

  useEffect(() => {
    if (!slug) return
    api.blog
      .get(slug)
      .then(post => { setPost(post); api.blog.view(slug).catch(() => {}) })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [slug])

  useEffect(() => {
    if (!post) return
    headingsRef.current = extractHeadings(post.content)
    if (headingsRef.current.length === 0) return

    const onScroll = () => {
      let current = headingsRef.current[0]?.id ?? ''
      for (const { id } of headingsRef.current) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= 120) current = id
      }
      setActiveId(current)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [post])

  // Reading depth beacon — fires Umami events at 25/50/75/100% scroll milestones
  useEffect(() => {
    if (!post || !slug) return
    const fired = new Set<number>()
    const startTime = Date.now()
    const milestones = [25, 50, 75, 100]
    const umami = (window as unknown as { umami?: { track: (name: string, data: Record<string, unknown>) => void } }).umami

    const onScroll = () => {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      if (docHeight <= 0) return
      const pct = Math.round((scrollTop / docHeight) * 100)

      for (const m of milestones) {
        if (pct >= m && !fired.has(m)) {
          fired.add(m)
          const elapsed = Math.round((Date.now() - startTime) / 1000)
          umami?.track('blog-read-depth', { slug, depth: m, seconds: elapsed })
        }
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [post, slug])

  if (loading) {
    return (
      <div className="max-w-[720px] mx-auto px-6 py-32 flex items-center gap-3 text-steel">
        <div className="w-4 h-4 border-2 border-blue/30 border-t-blue rounded-full animate-spin" />
        <span className="font-mono text-sm">Loading…</span>
      </div>
    )
  }

  if (notFound || !post) {
    return (
      <div className="max-w-[720px] mx-auto px-6 py-32 text-center">
        <p className="text-steel font-mono text-sm mb-6">Post not found.</p>
        <Link to="/blog" className="font-mono text-xs text-blue hover:underline underline-offset-2">
          ← Back to Blog
        </Link>
      </div>
    )
  }

  const toc = headingsRef.current

  return (
    <div className="max-w-[720px] xl:max-w-[1060px] mx-auto px-6 py-16">
      <div className="xl:grid xl:grid-cols-[1fr_200px] xl:gap-12 xl:items-start">
        {/* Main column */}
        <div>
      {/* Back */}
      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="mb-12">
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 font-mono text-xs text-steel hover:text-blue transition-colors"
        >
          <ArrowLeft size={13} />
          All Posts
        </Link>
      </motion.div>

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="mb-10"
      >
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {post.tags.map(tag => (
              <span
                key={tag}
                className="font-mono text-[10px] px-2.5 py-1 rounded-full bg-blue-wash text-blue uppercase tracking-wider"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <h1 className="text-3xl md:text-4xl font-sans font-bold text-ink mb-4 leading-tight">
          {post.title}
        </h1>

        {post.subtitle && (
          <p className="text-xl text-steel mb-6 leading-snug">{post.subtitle}</p>
        )}

        <div className="flex items-center gap-5 text-xs font-mono text-silver pb-8 border-b border-mist">
          {post.published_at && (
            <span className="flex items-center gap-1.5">
              <Calendar size={12} />
              {formatDate(post.published_at)}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Clock size={12} />
            {readTime(post.content)} min read
          </span>
          {(post.view_count ?? 0) > 0 && (
            <span className="flex items-center gap-1.5">
              <Eye size={12} />
              {(post.view_count ?? 0).toLocaleString()} views
            </span>
          )}
        </div>
      </motion.header>

      {/* Cover image */}
      {post.cover_image_url && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.12 }}
          className="mb-10 rounded-xl overflow-hidden border border-mist"
        >
          <img src={post.cover_image_url} alt={post.title} className="w-full object-cover max-h-[420px]" />
        </motion.div>
      )}

      {/* Markdown content */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkFrontmatter, remarkEmoji, remarkMath]}
          rehypePlugins={[rehypeRaw, rehypeKatex]}
          components={{
            h1: ({ children, node }) => {
              const id = headingId(node)
              return <h1 id={id} className="text-2xl font-sans font-bold text-ink mt-10 mb-4 leading-snug">{children}</h1>
            },
            h2: ({ children, node }) => {
              const id = headingId(node)
              return <h2 id={id} className="text-xl font-sans font-semibold text-ink mt-8 mb-3 leading-snug">{children}</h2>
            },
            h3: ({ children, node }) => {
              const id = headingId(node)
              return <h3 id={id} className="text-lg font-sans font-semibold text-ink mt-6 mb-2">{children}</h3>
            },
            h4: ({ children, node }) => {
              const id = headingId(node)
              return <h4 id={id} className="font-sans font-semibold text-ink mt-5 mb-2">{children}</h4>
            },
            p: ({ children, ...props }) => (
              <p className="text-ink/80 leading-7 mb-5 text-base" {...props}>{children}</p>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-ink">{children}</strong>
            ),
            em: ({ children }) => (
              <em className="italic">{children}</em>
            ),
            a: ({ href, children, ...props }) => {
              if (href?.startsWith('#')) {
                return <a href={href} className="text-blue hover:underline underline-offset-2" {...props}>{children}</a>
              }
              return (
                <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue hover:underline underline-offset-2" {...props}>
                  {children}
                </a>
              )
            },
            ul: ({ children }) => (
              <ul className="list-disc list-outside pl-5 mb-5 space-y-1.5 text-ink/80">{children}</ul>
            ),
            ol: ({ children, ...props }) => (
              <ol className="list-decimal list-outside pl-5 mb-5 space-y-1.5 text-ink/80" {...props}>{children}</ol>
            ),
            li: ({ children, ...props }) => (
              <li className="leading-7 text-base" {...props}>{children}</li>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-blue/30 pl-5 my-6 text-steel italic">
                {children}
              </blockquote>
            ),
            pre: ({ children }) => (
              <pre className="bg-[#1a1a2e] text-[#e2e8f0] p-5 rounded-xl overflow-x-auto my-6 text-sm leading-relaxed font-mono">
                {children}
              </pre>
            ),
            code: ({ className, children, ...props }) => {
              const isBlock = className?.startsWith('language-')
              if (isBlock) {
                return <code className={className} {...props}>{children}</code>
              }
              return (
                <code className="font-mono text-sm bg-cloud text-blue px-1.5 py-0.5 rounded" {...props}>
                  {children}
                </code>
              )
            },
            hr: () => <hr className="border-mist my-8" />,
            img: ({ src, alt }) => (
              <img src={src} alt={alt} loading="lazy" className="w-full rounded-xl my-6 border border-mist" />
            ),
            table: ({ children }) => (
              <div className="overflow-x-auto my-6 rounded-xl border border-mist">
                <table className="w-full text-sm border-collapse">{children}</table>
              </div>
            ),
            thead: ({ children }) => <thead className="bg-cloud">{children}</thead>,
            th: ({ children }) => (
              <th className="border-b border-mist px-4 py-2.5 font-mono text-[11px] text-steel uppercase tracking-wider text-left">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border-b border-mist/60 px-4 py-2.5 text-ink/80">{children}</td>
            ),
            input: ({ type, checked, ...props }) => {
              if (type === 'checkbox') {
                return (
                  <input
                    type="checkbox"
                    checked={checked}
                    readOnly
                    className="mr-2 accent-blue"
                    {...props}
                  />
                )
              }
              return <input type={type} {...props} />
            },
            del: ({ children }) => (
              <del className="text-steel line-through">{children}</del>
            ),
            sup: ({ children, ...props }) => (
              <sup className="text-xs text-blue" {...props}>{children}</sup>
            ),
            sub: ({ children }) => <sub className="text-xs">{children}</sub>,
            section: ({ children, node, ...props }) => {
              const dp = props as Record<string, unknown>
              if (dp['data-footnotes'] || dp['dataFootnotes'] || (node?.properties as Record<string, unknown>)?.['dataFootnotes']) {
                return (
                  <section data-footnotes="true" className="mt-12 pt-6 border-t border-mist text-sm text-ink/70">
                    <h2 className="font-mono text-[11px] uppercase tracking-wider text-silver mb-4">Footnotes</h2>
                    {children}
                  </section>
                )
              }
              return <section {...props}>{children}</section>
            },
          }}
        >
          {post.content}
        </ReactMarkdown>
      </motion.div>

      {/* Share + Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-16 pt-8 border-t border-mist"
      >
        <div className="flex items-center justify-between mb-8">
          <span className="font-mono text-[11px] text-steel uppercase tracking-wider">Share this post</span>
          <div className="flex items-center gap-2">
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(`https://nathanblatter.com/blog/${post.slug}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-mist text-steel hover:text-ink hover:border-ink/20 transition-all font-mono text-[11px]"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              Post
            </a>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`https://nathanblatter.com/blog/${post.slug}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-mist text-steel hover:text-[#0a66c2] hover:border-[#0a66c2]/30 transition-all font-mono text-[11px]"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              Share
            </a>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`https://nathanblatter.com/blog/${post.slug}`)
                setCopied(true)
                clearTimeout(copyTimerRef.current)
                copyTimerRef.current = setTimeout(() => setCopied(false), 2000)
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border transition-all font-mono text-[11px] ${
                copied ? 'border-teal/30 text-teal bg-teal/5' : 'border-mist text-steel hover:text-blue hover:border-blue/30'
              }`}
            >
              {copied ? <><Check size={12} /> Copied</> : <><Link2 size={12} /> Copy Link</>}
            </button>
          </div>
        </div>
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 font-mono text-xs text-steel hover:text-blue transition-colors"
        >
          <ArrowLeft size={13} />
          Back to All Posts
        </Link>
      </motion.div>
        </div>{/* end main column */}

        {/* Table of Contents sidebar */}
        {toc.length >= 2 && (
          <aside className="hidden xl:block">
            <div className="sticky top-24">
              <p className="font-mono text-[10px] uppercase tracking-widest text-silver mb-3">On this page</p>
              <nav className="space-y-1">
                {toc.map(({ id, text, level }) => (
                  <a
                    key={id}
                    href={`#${id}`}
                    onClick={e => {
                      e.preventDefault()
                      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
                    }}
                    className={`block font-mono text-[11px] leading-snug transition-colors truncate ${
                      level === 3 ? 'pl-3' : ''
                    } ${
                      activeId === id
                        ? 'text-blue'
                        : 'text-silver hover:text-steel'
                    }`}
                  >
                    {text}
                  </a>
                ))}
              </nav>
            </div>
          </aside>
        )}
      </div>{/* end grid */}
    </div>
  )
}
