import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { X } from 'lucide-react'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('cookie-consent')) {
      setVisible(true)
    }
  }, [])

  const dismiss = () => {
    localStorage.setItem('cookie-consent', '1')
    setVisible(false)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50"
        >
          <div className="bg-white border border-mist rounded-2xl shadow-xl shadow-ink/5 p-5">
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="text-sm font-medium text-ink">No tracking cookies here</p>
              <button
                onClick={dismiss}
                className="text-silver hover:text-steel transition-colors shrink-0 mt-0.5"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
            <p className="text-xs text-steel leading-relaxed mb-4">
              This site uses{' '}
              <span className="text-ink font-medium">Umami Analytics</span> — cookieless,
              anonymous, and self-hosted. No personal data is collected or sold.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={dismiss}
                className="px-4 py-2 bg-blue text-white font-mono text-xs font-semibold rounded-lg hover:bg-blue-dim transition-colors"
              >
                Got it
              </button>
              <Link
                to="/privacy"
                onClick={dismiss}
                className="font-mono text-xs text-steel hover:text-blue transition-colors"
              >
                Privacy Policy
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
