import { useEffect } from 'react'

const SITE_ORIGIN = 'https://nathanblatter.com'

export interface DocumentMeta {
  title?: string
  description?: string
  /** Absolute URL or a path like "/about" (resolved against https://nathanblatter.com) */
  canonical?: string
  ogImage?: string
}

interface MetaDefaults {
  title: string
  description: string
  canonical: string
  ogImage: string
}

// Read the site-wide defaults from index.html exactly once, lazily (so the
// document is guaranteed to exist when we look).
let defaults: MetaDefaults | null = null

function getDefaults(): MetaDefaults {
  if (!defaults) {
    defaults = {
      title: document.title,
      description:
        document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? '',
      canonical:
        document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? `${SITE_ORIGIN}/`,
      ogImage:
        document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content ?? '',
    }
  }
  return defaults
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

function resolveUrl(url: string): string {
  return url.startsWith('/') ? `${SITE_ORIGIN}${url}` : url
}

function apply(meta: DocumentMeta) {
  const d = getDefaults()
  const title = meta.title ?? d.title
  const description = meta.description ?? d.description
  const canonical = meta.canonical ? resolveUrl(meta.canonical) : d.canonical
  const ogImage = meta.ogImage ? resolveUrl(meta.ogImage) : d.ogImage

  document.title = title
  upsertMeta('name', 'description', description)
  upsertCanonical(canonical)

  upsertMeta('property', 'og:title', title)
  upsertMeta('property', 'og:description', description)
  upsertMeta('property', 'og:url', canonical)
  upsertMeta('property', 'og:image', ogImage)

  upsertMeta('name', 'twitter:card', 'summary_large_image')
  upsertMeta('name', 'twitter:title', title)
  upsertMeta('name', 'twitter:description', description)
  upsertMeta('name', 'twitter:image', ogImage)
}

/**
 * Per-page SEO meta. Sets document.title, meta description, canonical link,
 * and OG/Twitter tags on mount (and whenever the values change), then restores
 * the index.html site defaults on unmount. Fields left undefined fall back to
 * the site defaults, so pages never leak meta into one another during SPA nav.
 */
export function useDocumentMeta({ title, description, canonical, ogImage }: DocumentMeta) {
  useEffect(() => {
    apply({ title, description, canonical, ogImage })
    return () => {
      apply({})
    }
  }, [title, description, canonical, ogImage])
}
