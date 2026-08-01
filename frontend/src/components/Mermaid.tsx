import { useEffect, useRef, useState, useId } from 'react'

// Lazy module cache so the (fairly large) mermaid package is only fetched
// once, on demand, when a post actually contains a ```mermaid block —
// dynamic import() keeps it out of the main bundle as its own chunk.
let mermaidModulePromise: Promise<typeof import('mermaid')> | null = null
function loadMermaid() {
  if (!mermaidModulePromise) mermaidModulePromise = import('mermaid')
  return mermaidModulePromise
}

function isDarkMode() {
  return document.documentElement.classList.contains('dark')
}

interface MermaidProps {
  code: string
}

export default function Mermaid({ code }: MermaidProps) {
  const reactId = useId().replace(/[^a-zA-Z0-9-]/g, '')
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [dark, setDark] = useState(isDarkMode)
  const renderToken = useRef(0)

  // The app toggles a `dark` class on <html> directly (see lib/useTheme.ts)
  // rather than exposing a theme context, so watch for that mutation to
  // re-render the diagram with the matching mermaid theme.
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(isDarkMode()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    const token = ++renderToken.current
    setError(false)

    loadMermaid()
      .then(async ({ default: mermaid }) => {
        if (cancelled || token !== renderToken.current) return
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: dark ? 'dark' : 'default',
        })
        const id = `mermaid-${reactId}-${token}`
        const { svg } = await mermaid.render(id, code)
        if (cancelled || token !== renderToken.current) return
        setSvg(svg)
      })
      .catch(() => {
        if (cancelled || token !== renderToken.current) return
        setError(true)
      })

    return () => {
      cancelled = true
    }
  }, [code, dark, reactId])

  if (error) {
    return (
      <div className="my-6 rounded-xl overflow-hidden border border-white/10 bg-[#282c34]">
        <div className="px-4 py-2 bg-black/25 border-b border-white/5">
          <span className="font-mono text-[11px] text-white/40 uppercase tracking-wider">mermaid</span>
        </div>
        <pre className="p-5 overflow-x-auto text-sm leading-relaxed font-mono text-[#abb2bf]">{code}</pre>
      </div>
    )
  }

  if (!svg) {
    return (
      <div className="my-6 rounded-xl border border-mist bg-cloud animate-pulse h-40" aria-hidden="true" />
    )
  }

  return (
    <div
      className="my-6 flex justify-center overflow-x-auto rounded-xl border border-mist p-4"
      // mermaid.render() returns sanitizer-cleaned SVG markup produced by the
      // trusted mermaid library itself (with securityLevel: 'strict', which
      // strips script/foreignObject/click handlers) — this never touches
      // user-supplied HTML directly, unlike the rehype-sanitize pipeline above.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
