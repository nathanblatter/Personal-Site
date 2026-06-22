import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </BrowserRouter>
  </StrictMode>,
)

// Register the service worker for offline caching / installability (PWA).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* non-fatal */ })
  })
}

// Report Core Web Vitals to Umami as custom events
function sendToUmami({ name, value }: { name: string; value: number }) {
  const umami = (window as unknown as { umami?: { track: (name: string, data: Record<string, unknown>) => void } }).umami
  if (umami) {
    umami.track(`web-vital-${name}`, { value: Math.round(name === 'CLS' ? value * 1000 : value) })
  }
}

onCLS(sendToUmami)
onFCP(sendToUmami)
onINP(sendToUmami)
onLCP(sendToUmami)
onTTFB(sendToUmami)
