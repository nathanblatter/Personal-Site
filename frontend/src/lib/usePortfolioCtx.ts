import { useState, useEffect } from 'react'
import { api, type PortfolioCtx } from './api'

export function usePortfolioCtx(): PortfolioCtx | null {
  const [ctx, setCtx] = useState<PortfolioCtx | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlSlug = params.get('ctx')
    if (urlSlug) {
      sessionStorage.setItem('portfolio_ctx_slug', urlSlug)
    }

    const slug = sessionStorage.getItem('portfolio_ctx_slug')
    if (!slug) return

    api.links.getCtx(slug)
      .then(data => setCtx(data))
      .catch(() => {
        sessionStorage.removeItem('portfolio_ctx_slug')
        setCtx(null)
      })
  }, [])

  return ctx
}
