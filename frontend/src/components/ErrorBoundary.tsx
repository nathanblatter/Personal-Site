import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

/**
 * Last line of defense: a render error in one page must not white-screen the
 * whole site. Shows a small recovery card inside the layout instead.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    if (import.meta.env.DEV) console.error(error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <section className="py-24 md:py-32">
        <div className="max-w-[560px] w-full mx-auto px-6 text-center">
          <p className="font-mono text-xs text-blue tracking-widest uppercase mb-4">Something broke</p>
          <h1 className="font-serif text-4xl md:text-5xl italic text-ink mb-4">This page hit an error</h1>
          <p className="text-steel mb-8">The rest of the site still works. Reloading usually fixes it; if it keeps happening, the bug button in the corner sends it straight to me.</p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => { this.setState({ error: null }); window.location.reload() }}
              className="px-6 py-3 bg-blue text-white font-mono text-sm font-semibold rounded-xl hover:bg-blue-dim transition-colors"
            >
              Reload
            </button>
            <a href="/" className="px-6 py-3 border border-mist text-steel font-mono text-sm rounded-xl hover:text-ink transition-colors">Home</a>
          </div>
        </div>
      </section>
    )
  }
}
