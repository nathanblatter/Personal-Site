import { useState, useCallback, useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { Menu, X, Sun, Moon, Search } from 'lucide-react'
import { useTheme } from '../lib/useTheme'
import CookieBanner from './CookieBanner'
import BugReport from './BugReport'
import SearchPalette from './SearchPalette'

const navLinks = [
  { to: '/', label: 'Home', code: '00' },
  { to: '/about', label: 'About', code: '01' },
  { to: '/projects', label: 'Projects', code: '02' },
  { to: '/blog', label: 'Blog', code: '03' },
  { to: '/now', label: 'Now', code: '04' },
  { to: '/uses', label: 'Uses', code: '05' },
  { to: '/contact', label: 'Contact', code: '06' },
]

const chunkMap: Record<string, () => Promise<unknown>> = {
  '/about': () => import('../pages/About'),
  '/projects': () => import('../pages/Projects'),
  '/blog': () => import('../pages/Blog'),
  '/now': () => import('../pages/Now'),
  '/uses': () => import('../pages/Uses'),
  '/contact': () => import('../pages/Contact'),
  '/resume': () => import('../pages/Resume'),
}
const prefetched = new Set<string>()

export default function Layout() {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { theme, toggle } = useTheme()

  // ⌘K / Ctrl+K opens search anywhere on the public site.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(o => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const prefetch = useCallback((to: string) => {
    if (prefetched.has(to) || !chunkMap[to]) return
    prefetched.add(to)
    chunkMap[to]()
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      {/* Skip to content — visible only when focused via keyboard */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-blue focus:text-white focus:font-mono focus:text-xs"
      >
        Skip to content
      </a>
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
                  onMouseEnter={() => prefetch(link.to)}
                  onFocus={() => prefetch(link.to)}
                  className={`relative px-4 py-2.5 font-mono text-xs tracking-wider transition-colors rounded-lg ${
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

          <div className="hidden md:flex items-center gap-3">
            {/* Search trigger */}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 pl-2.5 pr-2 py-1.5 rounded-lg border border-mist text-steel hover:text-ink hover:border-blue/30 transition-colors"
              aria-label="Search"
            >
              <Search size={14} />
              <kbd className="font-mono text-[10px] text-silver border border-mist rounded px-1 py-px">⌘K</kbd>
            </button>

            {/* Status indicator */}
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-teal animate-pulse" />
              <span className="font-mono text-xs text-steel">Available for work</span>
            </div>

            {/* Theme toggle */}
            <button
              onClick={toggle}
              className="p-2 rounded-lg text-steel hover:text-ink hover:bg-cloud transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>

          {/* Mobile controls */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={() => setSearchOpen(true)}
              className="p-2 rounded-lg text-steel hover:text-ink transition-colors"
              aria-label="Search"
            >
              <Search size={18} />
            </button>
            <button
              onClick={toggle}
              className="p-2 rounded-lg text-steel hover:text-ink transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="text-ink p-2"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
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
      <main id="main-content" className="flex-1 pt-24">
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
            <Link
              to="/status"
              className="font-mono text-xs text-steel hover:text-blue transition-colors"
            >
              Status
            </Link>
            <Link
              to="/privacy"
              className="font-mono text-xs text-steel hover:text-blue transition-colors"
            >
              Privacy
            </Link>
          </div>
        </div>
      </footer>

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <CookieBanner />
      <BugReport />
    </div>
  )
}
