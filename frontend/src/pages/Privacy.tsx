import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentMeta } from '../lib/useDocumentMeta'
import { api, type PrivacyResponse, type PrivacySection } from '../lib/api'

function SectionBlock({ section }: { section: PrivacySection }) {
  return (
    <section className="space-y-3">
      <h2 className="font-sans font-semibold text-ink text-xl">{section.heading}</h2>
      {section.paragraphs?.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {section.bullets && section.bullets.length > 0 && (
        <ul className="list-disc list-inside space-y-1 pl-2 text-sm">
          {section.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
      {section.footnote && <p>{section.footnote}</p>}
      {section.table && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-mist">
                {section.table.columns.map((c, i) => (
                  <th key={i} className="text-left py-2 pr-4 font-mono text-xs text-blue font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-mist">
              {section.table.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={`py-2.5 pr-4 text-xs ${ci === 0 ? 'font-mono text-ink' : ''}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {section.links && section.links.length > 0 && (
        <div className="space-y-4">
          {section.links.map((l, i) => (
            <div key={i}>
              <p className="text-ink font-medium text-sm mb-1">{l.name}</p>
              <p className="text-sm">
                {l.note}{' '}
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue hover:underline"
                >
                  Learn more
                </a>
                .
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function PrivacySkeleton() {
  return (
    <div className="prose-custom space-y-10 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <div className="h-6 w-48 rounded bg-mist/60" />
          <div className="h-4 w-full rounded bg-mist/40" />
          <div className="h-4 w-11/12 rounded bg-mist/40" />
          <div className="h-4 w-4/5 rounded bg-mist/40" />
        </div>
      ))}
    </div>
  )
}

export default function Privacy() {
  useDocumentMeta({
    title: 'Privacy — Nathan Blatter',
    description: 'Privacy policy for nathanblatter.com — what data is collected and how it is used.',
    canonical: '/privacy',
  })
  const [data, setData] = useState<PrivacyResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    api.privacy
      .get()
      .then((d) => {
        if (alive) setData(d)
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  return (
    <section className="py-16 md:py-24 min-h-screen">
      <div className="max-w-[720px] w-full mx-auto px-6">
        <div className="mb-12">
          <span className="font-mono text-xs text-blue tracking-[0.2em] uppercase">// LEGAL</span>
          <h1 className="font-serif text-4xl md:text-5xl italic text-ink mt-3 mb-4">
            {data?.title ?? 'Privacy Policy'}
          </h1>
          {loading ? (
            <div className="h-3 w-32 rounded bg-mist/50 animate-pulse" />
          ) : (
            <p className="font-mono text-xs text-steel">
              Last updated: {data?.effective_date ?? ''}
            </p>
          )}
        </div>

        {loading ? (
          <PrivacySkeleton />
        ) : data ? (
          <div className="prose-custom space-y-10 text-steel leading-relaxed">
            <section className="space-y-3">
              <h2 className="font-sans font-semibold text-ink text-xl">Overview</h2>
              <p>{data.overview}</p>
            </section>

            {data.sections.map((s) => (
              <SectionBlock key={s.id} section={s} />
            ))}

            <section className="space-y-3">
              <h2 className="font-sans font-semibold text-ink text-xl">Contact</h2>
              <p>
                Questions about this policy?{' '}
                <Link to={data.contact_url || '/contact'} className="text-blue hover:underline">
                  Get in touch
                </Link>
                .
              </p>
            </section>
          </div>
        ) : (
          <p className="text-steel">Unable to load the privacy policy right now.</p>
        )}
      </div>
    </section>
  )
}
