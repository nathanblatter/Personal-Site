/**
 * Tiny module-level promise cache for read-only API calls that several
 * components fire on the same page (e.g. GitHub repos on the home page) or
 * that would otherwise re-run on every client-side route change.
 *
 * - In-flight promises are shared, so concurrent callers make one request.
 * - Successful results are kept for `ttlMs` (default: the rest of the session).
 * - Failures are evicted immediately so the next caller can retry.
 */
const store = new Map<string, { promise: Promise<unknown>; expires: number }>()

export function cached<T>(key: string, fn: () => Promise<T>, ttlMs = Infinity): Promise<T> {
  const hit = store.get(key)
  if (hit && hit.expires > Date.now()) return hit.promise as Promise<T>
  const promise = fn().catch(err => {
    store.delete(key)
    throw err
  })
  store.set(key, { promise, expires: Date.now() + ttlMs })
  return promise
}

export function invalidate(key: string) {
  store.delete(key)
}
