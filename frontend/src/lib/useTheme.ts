import { useState, useEffect, useLayoutEffect } from 'react'
import { api } from './api'

type Theme = 'light' | 'dark'

const MANUAL_KEY = 'theme_manual'  // { mode, expires } — 24hr TTL
const SOLAR_KEY  = 'solar_cache'   // { mode, expires } — 30min TTL
const MANUAL_TTL = 24 * 60 * 60 * 1000
const SOLAR_TTL  = 30 * 60 * 1000

function readCached(key: string): Theme | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { mode, expires } = JSON.parse(raw)
    if (Date.now() < expires && (mode === 'light' || mode === 'dark')) return mode
    localStorage.removeItem(key)
  } catch {}
  return null
}

function getInitialTheme(): Theme {
  return (
    readCached(MANUAL_KEY) ??
    readCached(SOLAR_KEY) ??
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  )
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  // Fetch solar only when no live manual preference
  useEffect(() => {
    if (readCached(MANUAL_KEY)) return
    api.solar.get().then(({ mode }) => {
      localStorage.setItem(SOLAR_KEY, JSON.stringify({ mode, expires: Date.now() + SOLAR_TTL }))
      setTheme(mode as Theme)
    }).catch(() => {})
  }, [])

  const toggle = () => {
    setTheme(t => {
      const next: Theme = t === 'dark' ? 'light' : 'dark'
      localStorage.setItem(MANUAL_KEY, JSON.stringify({ mode: next, expires: Date.now() + MANUAL_TTL }))
      return next
    })
  }

  return { theme, toggle }
}
