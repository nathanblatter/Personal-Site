import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft, ArrowRight } from 'lucide-react'

export default function NotFound() {
  const location = useLocation()
  const [suggestion, setSuggestion] = useState<string | null>(null)

  useEffect(() => {
    const path = location.pathname.replace(/^\//, '')
    if (!path) return
    fetch(`/api/v1/suggest?path=${encodeURIComponent(path)}`)
      .then(r => r.json())
      .then(data => {
        if (data.suggestion) setSuggestion(data.suggestion)
      })
      .catch(() => {})
  }, [location.pathname])

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md"
      >
        <div className="font-mono text-8xl font-bold text-mist mb-6">404</div>
        <h1 className="text-2xl font-sans font-semibold text-ink mb-3">Page not found</h1>
        <p className="text-steel text-sm leading-relaxed mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>

        {suggestion && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-6"
          >
            <p className="text-steel text-xs font-mono mb-2">Did you mean?</p>
            <Link
              to={suggestion}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-wash text-blue font-mono text-xs font-semibold rounded-lg hover:bg-blue/10 transition-colors"
            >
              {suggestion} <ArrowRight size={12} />
            </Link>
          </motion.div>
        )}

        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue text-white font-mono text-xs font-semibold rounded-xl hover:bg-blue-dim transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Home
        </Link>
      </motion.div>
    </div>
  )
}
