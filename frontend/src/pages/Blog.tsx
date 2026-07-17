import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { Calendar, Clock, Eye, ArrowRight, Search, X } from 'lucide-react'
import { api, type BlogPostResponse } from '../lib/api'
import { readTime, formatDate } from '../lib/blogUtils'
import NewsletterSignup from '../components/NewsletterSignup'

export default function Blog() {
  const [posts, setPosts] = useState<BlogPostResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    const doFetch = () => {
      setLoading(true)
      setError(false)
      api.blog.list(query || undefined)
        .then(setPosts)
        .catch(() => { setPosts([]); setError(true) })
        .finally(() => setLoading(false))
    }
    if (!query) { doFetch(); return }
    debounceRef.current = setTimeout(doFetch, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query, retryKey])

  // Tags are free-text per post, so case/whitespace variants of the same tag
  // ("Claude" vs "claude ") must collapse into one filter. Normalize to a key,
  // keep the first display spelling seen, and match against the key everywhere.
  const tagKey = (t: string) => t.trim().toLowerCase()
  const postHasTag = (p: (typeof posts)[number], key: string) => p.tags.some(t => tagKey(t) === key)

  // Drop a tag filter that no longer exists in the current result set.
  useEffect(() => {
    if (activeTag && !posts.some(p => postHasTag(p, tagKey(activeTag)))) setActiveTag(null)
  }, [posts, activeTag])

  const allTags = Array.from(
    posts.reduce((acc, p) => {
      for (const t of p.tags) {
        const key = tagKey(t)
        if (key && !acc.has(key)) acc.set(key, t.trim())
      }
      return acc
    }, new Map<string, string>()).values(),
  ).sort((a, b) => a.localeCompare(b))
  const displayedPosts = activeTag ? posts.filter(p => postHasTag(p, tagKey(activeTag))) : posts

  return (
    <div className="max-w-[1100px] w-full mx-auto px-6 py-20">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-16"
      >
        <span className="font-mono text-xs text-blue tracking-widest uppercase">Writing</span>
        <h1 className="text-4xl md:text-5xl font-sans font-semibold text-ink mt-3 mb-4">
          Blog
        </h1>
        <p className="text-steel text-lg max-w-xl">
          Thoughts on software, technology, and things I'm learning.
        </p>

        <div className="relative mt-6 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-silver" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search posts…"
            className="w-full pl-9 pr-8 py-2 text-sm font-mono bg-white border border-mist rounded-lg text-ink placeholder:text-silver focus:outline-none focus:border-blue/40 focus:ring-1 focus:ring-blue/20 transition-colors"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-silver hover:text-steel">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-5">
            <button
              onClick={() => setActiveTag(null)}
              className={`font-mono text-[11px] px-3 py-1 rounded-full border transition-colors ${
                activeTag === null
                  ? 'border-blue text-blue bg-blue-wash'
                  : 'border-mist text-steel hover:border-silver hover:text-ink'
              }`}
            >
              All
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(t => (t === tag ? null : tag))}
                className={`font-mono text-[11px] px-3 py-1 rounded-full border uppercase tracking-wider transition-colors ${
                  activeTag === tag
                    ? 'border-blue text-blue bg-blue-wash'
                    : 'border-mist text-steel hover:border-silver hover:text-ink'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </motion.div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center gap-3 text-steel">
          <div className="w-4 h-4 border-2 border-blue/30 border-t-blue rounded-full animate-spin" />
          <span className="font-mono text-sm">Loading posts…</span>
        </div>
      ) : error ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-32 text-steel"
        >
          <p className="font-mono text-sm mb-2">Failed to load posts.</p>
          <button
            onClick={() => setRetryKey(k => k + 1)}
            className="font-mono text-xs text-blue hover:underline underline-offset-2 mt-1"
          >
            Try again
          </button>
        </motion.div>
      ) : posts.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-32 text-steel"
        >
          {query ? (
            <>
              <p className="font-mono text-sm mb-2">No posts matching "{query}"</p>
              <button onClick={() => setQuery('')} className="font-mono text-xs text-blue hover:underline underline-offset-2">
                Clear search
              </button>
            </>
          ) : (
            <>
              <p className="font-mono text-sm mb-2">No posts yet.</p>
              <p className="text-xs text-silver">Check back soon.</p>
            </>
          )}
        </motion.div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {displayedPosts.map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
            >
              <Link to={`/blog/${post.slug}`} className="group block h-full">
                <article className="h-full bg-white border border-mist rounded-xl overflow-hidden hover:border-blue/30 hover:shadow-lg hover:shadow-blue/5 transition-all duration-300">
                  {post.cover_image_url && (
                    <div className="h-44 overflow-hidden">
                      <img
                        src={post.cover_image_url}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  )}
                  <div className="p-6 flex flex-col h-full">
                    {/* Tags */}
                    {post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {post.tags.slice(0, 4).map(tag => (
                          <span
                            key={tag}
                            className="font-mono text-[10px] px-2.5 py-0.5 rounded-full bg-blue-wash text-blue uppercase tracking-wider"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <h2 className="text-[17px] font-sans font-semibold text-ink mb-2 group-hover:text-blue transition-colors leading-snug">
                      {post.title}
                    </h2>

                    {post.subtitle && (
                      <p className="text-steel text-sm mb-2 font-medium">{post.subtitle}</p>
                    )}

                    {post.excerpt && (
                      <p className="text-steel/80 text-sm leading-relaxed mb-4 line-clamp-3">
                        {post.excerpt}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-silver text-[11px] font-mono mt-auto pt-4 border-t border-mist">
                      {post.published_at && (
                        <span className="flex items-center gap-1.5">
                          <Calendar size={11} />
                          {formatDate(post.published_at)}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Clock size={11} />
                        {readTime(post.content)} min read
                      </span>
                      {(post.view_count ?? 0) > 0 && (
                        <span className="flex items-center gap-1.5">
                          <Eye size={11} />
                          {(post.view_count ?? 0).toLocaleString()}
                        </span>
                      )}
                      <span className="ml-auto flex items-center gap-1 text-blue opacity-0 group-hover:opacity-100 transition-opacity text-xs">
                        Read <ArrowRight size={11} />
                      </span>
                    </div>
                  </div>
                </article>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {/* Newsletter */}
      <div className="mt-20">
        <NewsletterSignup />
      </div>
    </div>
  )
}
