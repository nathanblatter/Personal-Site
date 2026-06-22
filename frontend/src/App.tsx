import { lazy, Suspense, useRef } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Layout from './components/Layout'
import Home from './pages/Home'
import NotFound from './pages/NotFound'
const Privacy = lazy(() => import('./pages/Privacy'))

const Projects = lazy(() => import('./pages/Projects'))
const CaseStudy = lazy(() => import('./pages/CaseStudy'))
const Now = lazy(() => import('./pages/Now'))
const Uses = lazy(() => import('./pages/Uses'))
const Status = lazy(() => import('./pages/Status'))
const About = lazy(() => import('./pages/About'))
const Contact = lazy(() => import('./pages/Contact'))
const Blog = lazy(() => import('./pages/Blog'))
const BlogPost = lazy(() => import('./pages/BlogPost'))
const Resume = lazy(() => import('./pages/Resume'))
const Admin = lazy(() => import('./pages/Admin'))
const Login = lazy(() => import('./pages/Login'))
const TestimonialForm = lazy(() => import('./pages/TestimonialForm'))
const LinkInBio = lazy(() => import('./pages/LinkInBio'))
const InvoiceView = lazy(() => import('./pages/InvoiceView'))
const ContractView = lazy(() => import('./pages/ContractView'))

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
          <Route path="/projects/:projectId" element={<Suspense fallback={null}><CaseStudy /></Suspense>} />
          <Route path="/now" element={<Suspense fallback={null}><Now /></Suspense>} />
          <Route path="/uses" element={<Suspense fallback={null}><Uses /></Suspense>} />
          <Route path="/status" element={<Suspense fallback={null}><Status /></Suspense>} />
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
        <Route path="/invoice/:token" element={<Suspense fallback={null}><InvoiceView /></Suspense>} />
        <Route path="/contract/:token" element={<Suspense fallback={null}><ContractView /></Suspense>} />
      </Routes>
    </div>
  )
}

export default App
