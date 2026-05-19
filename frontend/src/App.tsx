import { lazy, Suspense, useEffect, useLayoutEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import { api } from './lib/api'

const SOLAR_KEY = 'solar_cache'
const SOLAR_TTL = 30 * 60 * 1000 // 30 min

function applyMode(mode: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', mode === 'dark')
}
import Home from './pages/Home'
import NotFound from './pages/NotFound'
const Privacy = lazy(() => import('./pages/Privacy'))

const Projects = lazy(() => import('./pages/Projects'))
const About = lazy(() => import('./pages/About'))
const Contact = lazy(() => import('./pages/Contact'))
const Blog = lazy(() => import('./pages/Blog'))
const BlogPost = lazy(() => import('./pages/BlogPost'))
const Resume = lazy(() => import('./pages/Resume'))
const Admin = lazy(() => import('./pages/Admin'))
const Login = lazy(() => import('./pages/Login'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function useSolarTheme() {
  // Apply cached mode before first paint to avoid flash
  useLayoutEffect(() => {
    try {
      const raw = localStorage.getItem(SOLAR_KEY)
      if (raw) {
        const { mode, expires } = JSON.parse(raw)
        if (Date.now() < expires) applyMode(mode)
      }
    } catch {}
  }, [])

  // Fetch fresh mode from backend
  useEffect(() => {
    api.solar.get().then(({ mode }) => {
      applyMode(mode)
      localStorage.setItem(SOLAR_KEY, JSON.stringify({ mode, expires: Date.now() + SOLAR_TTL }))
    }).catch(() => {})
  }, [])
}

function App() {
  useSolarTheme()
  return (
    <div>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/projects" element={<Suspense fallback={null}><Projects /></Suspense>} />
          <Route path="/about" element={<Suspense fallback={null}><About /></Suspense>} />
          <Route path="/contact" element={<Suspense fallback={null}><Contact /></Suspense>} />
          <Route path="/resume" element={<Suspense fallback={null}><Resume /></Suspense>} />
          <Route path="/blog" element={<Suspense fallback={null}><Blog /></Suspense>} />
          <Route path="/blog/:slug" element={<Suspense fallback={null}><BlogPost /></Suspense>} />
          <Route path="/privacy" element={<Suspense fallback={null}><Privacy /></Suspense>} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="/admin" element={<Suspense fallback={null}><Admin /></Suspense>} />
        <Route path="/admin/login" element={<Suspense fallback={null}><Login /></Suspense>} />
      </Routes>
    </div>
  )
}

export default App
