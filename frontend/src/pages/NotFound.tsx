import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowLeft } from 'lucide-react'

export default function NotFound() {
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
