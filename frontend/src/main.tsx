import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

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
