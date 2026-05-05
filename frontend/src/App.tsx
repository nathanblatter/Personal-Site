import { lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Layout from './components/Layout'
import Home from './pages/Home'
import Projects from './pages/Projects'
import About from './pages/About'
import Contact from './pages/Contact'
import Blog from './pages/Blog'
const BlogPost = lazy(() => import('./pages/BlogPost'))
import Resume from './pages/Resume'
import NotFound from './pages/NotFound'

const Admin = lazy(() => import('./pages/Admin'))
const Login = lazy(() => import('./pages/Login'))

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function App() {
  return (
    <div>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/resume" element={<Resume />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<Suspense fallback={null}><BlogPost /></Suspense>} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="/admin" element={<Suspense fallback={null}><Admin /></Suspense>} />
        <Route path="/admin/login" element={<Suspense fallback={null}><Login /></Suspense>} />
      </Routes>
    </div>
  )
}

export default App
