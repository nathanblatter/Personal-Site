import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Menu, X } from 'lucide-react'

const navLinks = [
  { to: '/', label: 'Home', code: '00' },
  { to: '/about', label: 'About', code: '01' },
  { to: '/projects', label: 'Projects', code: '02' },
  { to: '/blog', label: 'Blog', code: '03' },
  { to: '/contact', label: 'Contact', code: '04' },
]

export default function Layout() {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-white/80 border-b border-mist">
        <div className="max-w-[1100px] w-full mx-auto px-6 h-18 flex items-center justify-between">
          <Link to="/" className="group flex items-center gap-3">
            <div className="w-9 h-9 bg-blue rounded-lg flex items-center justify-center">
              <span className="font-mono text-white text-sm font-bold">NB</span>
            </div>
            <span className="font-mono text-xs text-steel group-hover:text-blue transition-colors tracking-wider">
              NathanBlatter.com
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-2">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.to
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`relative px-5 py-2.5 font-mono text-xs tracking-wider transition-colors rounded-lg ${
                    isActive ? 'text-blue bg-blue-wash' : 'text-steel hover:text-ink hover:bg-cloud'
                  }`}
                >
                  {link.label.toUpperCase()}
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue rounded-full"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </Link>
              )
            })}
          </div>

          {/* Status indicator */}
          <div className="hidden md:flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-teal animate-pulse" />
            <span className="font-mono text-xs text-steel">Available for work</span>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden text-ink p-2"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-white/98 backdrop-blur-2xl pt-24"
          >
            <div className="flex flex-col items-center gap-8 p-8">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.to}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Link
                    to={link.to}
                    onClick={() => setMobileOpen(false)}
                    className={`font-serif text-4xl italic ${
                      location.pathname === link.to ? 'text-blue' : 'text-ink'
                    }`}
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page content */}
      <main className="flex-1 pt-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-mist py-10 md:py-14 bg-snow">
        <div className="max-w-[1100px] w-full mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-7 h-7 bg-blue/10 rounded-md flex items-center justify-center">
              <span className="font-mono text-blue text-[10px] font-bold">NB</span>
            </div>
            <span className="font-mono text-xs text-steel">
              &copy; {new Date().getFullYear()} Nathan Blatter
            </span>
          </div>
          <div className="flex items-center gap-6 md:gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="font-mono text-xs text-steel hover:text-blue transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="font-mono text-xs text-silver">
            Built with React + Tailwind
          </div>
        </div>
      </footer>
    </div>
  )
}
