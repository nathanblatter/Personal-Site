import { lazy, Suspense, useRef } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Layout from './components/Layout'
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
const TestimonialForm = lazy(() => import('./pages/TestimonialForm'))
const LinkInBio = lazy(() => import('./pages/LinkInBio'))

function ScrollToTop() {
  const { pathname } = useLocation()
  const prevPath = useRef(pathname)
  useEffect(() => {
    if (prevPath.current !== pathname) {
      const navType = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)?.type
      if (navType !== 'back_forward') {
        window.scrollTo(0, 0)
      }
      prevPath.current = pathname
    }
  }, [pathname])
  return null
}

function App() {
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
        <Route path="/testimonial/:slug" element={<Suspense fallback={null}><TestimonialForm /></Suspense>} />
        <Route path="/linkinbio" element={<Suspense fallback={null}><LinkInBio /></Suspense>} />
      </Routes>
    </div>
  )
}

export default App
