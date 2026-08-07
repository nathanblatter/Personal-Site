import { lazy, Suspense, useRef } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Layout from './components/Layout'
import Skeleton from './components/Skeleton'
import Home from './pages/Home'
import NotFound from './pages/NotFound'
const Privacy = lazy(() => import('./pages/Privacy'))

const Projects = lazy(() => import('./pages/Projects'))
const CaseStudy = lazy(() => import('./pages/CaseStudy'))
const Now = lazy(() => import('./pages/Now'))
const Uses = lazy(() => import('./pages/Uses'))
const Status = lazy(() => import('./pages/Status'))
const About = lazy(() => import('./pages/About'))
const Services = lazy(() => import('./pages/Services'))
const Contact = lazy(() => import('./pages/Contact'))
const Blog = lazy(() => import('./pages/Blog'))
const BlogPost = lazy(() => import('./pages/BlogPost'))
const Resume = lazy(() => import('./pages/Resume'))
const Admin = lazy(() => import('./pages/Admin'))
const Login = lazy(() => import('./pages/Login'))
const TestimonialForm = lazy(() => import('./pages/TestimonialForm'))
const LinkInBio = lazy(() => import('./pages/LinkInBio'))
const InvoiceView = lazy(() => import('./pages/InvoiceView'))
const QuickUpdate = lazy(() => import('./pages/QuickUpdate'))
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

// Route-level Suspense fallback: a lightweight page-shell skeleton (header +
// paragraph blocks) so lazy chunks don't flash a blank screen while loading.
function PageFallback() {
  return (
    <div className="max-w-[1100px] w-full mx-auto px-6 py-20">
      <Skeleton className="h-3 w-24 mb-4" />
      <Skeleton className="h-10 w-64 mb-6" />
      <div className="max-w-xl space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  )
}

function App() {
  return (
    <div>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/projects" element={<Suspense fallback={<PageFallback />}><Projects /></Suspense>} />
          <Route path="/projects/:projectId" element={<Suspense fallback={<PageFallback />}><CaseStudy /></Suspense>} />
          <Route path="/now" element={<Suspense fallback={<PageFallback />}><Now /></Suspense>} />
          <Route path="/uses" element={<Suspense fallback={<PageFallback />}><Uses /></Suspense>} />
          <Route path="/status" element={<Suspense fallback={<PageFallback />}><Status /></Suspense>} />
          <Route path="/about" element={<Suspense fallback={<PageFallback />}><About /></Suspense>} />
          <Route path="/services" element={<Suspense fallback={<PageFallback />}><Services /></Suspense>} />
          <Route path="/contact" element={<Suspense fallback={<PageFallback />}><Contact /></Suspense>} />
          <Route path="/resume" element={<Suspense fallback={<PageFallback />}><Resume /></Suspense>} />
          <Route path="/blog" element={<Suspense fallback={<PageFallback />}><Blog /></Suspense>} />
          <Route path="/blog/:slug" element={<Suspense fallback={<PageFallback />}><BlogPost /></Suspense>} />
          <Route path="/privacy" element={<Suspense fallback={<PageFallback />}><Privacy /></Suspense>} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="/admin" element={<Suspense fallback={<PageFallback />}><Admin /></Suspense>} />
        <Route path="/admin/login" element={<Suspense fallback={<PageFallback />}><Login /></Suspense>} />
        <Route path="/testimonial/:slug" element={<Suspense fallback={<PageFallback />}><TestimonialForm /></Suspense>} />
        <Route path="/linkinbio" element={<Suspense fallback={<PageFallback />}><LinkInBio /></Suspense>} />
        <Route path="/invoice/:token" element={<Suspense fallback={<PageFallback />}><InvoiceView /></Suspense>} />
        <Route path="/quick-update/:token" element={<Suspense fallback={<PageFallback />}><QuickUpdate /></Suspense>} />
        <Route path="/contract/:token" element={<Suspense fallback={<PageFallback />}><ContractView /></Suspense>} />
      </Routes>
    </div>
  )
}

export default App
