import { useEffect, useState } from 'react'

interface Settled<T> {
  key: number
  data?: T
  error?: true
}

/**
 * Runs `load()` on mount and again whenever `retryKey` changes.
 *
 * `loading` / `error` are *derived* from which retryKey the last settled
 * result belongs to, so the effect never calls setState synchronously
 * (react-hooks/set-state-in-effect) and a retry flips back to loading
 * without an extra render. `load` must be referentially stable — pass the
 * `api.*` method directly rather than an inline arrow.
 */
export function useAsyncData<T>(load: () => Promise<T>, retryKey = 0) {
  const [settled, setSettled] = useState<Settled<T>>({ key: -1 })

  useEffect(() => {
    let cancelled = false
    load()
      .then(data => { if (!cancelled) setSettled({ key: retryKey, data }) })
      .catch(() => { if (!cancelled) setSettled({ key: retryKey, error: true }) })
    return () => { cancelled = true }
  }, [load, retryKey])

  const current = settled.key === retryKey
  return {
    data: current ? settled.data : undefined,
    error: current && settled.error === true,
    loading: !current,
  }
}
