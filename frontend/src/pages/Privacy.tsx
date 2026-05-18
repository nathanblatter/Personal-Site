export default function Privacy() {
  return (
    <section className="py-16 md:py-24 min-h-screen">
      <div className="max-w-[720px] w-full mx-auto px-6">
        <div className="mb-12">
          <span className="font-mono text-xs text-blue tracking-[0.2em] uppercase">// LEGAL</span>
          <h1 className="font-serif text-4xl md:text-5xl italic text-ink mt-3 mb-4">Privacy Policy</h1>
          <p className="font-mono text-xs text-steel">Last updated: May 2026</p>
        </div>

        <div className="prose-custom space-y-10 text-steel leading-relaxed">

          <section className="space-y-3">
            <h2 className="font-sans font-semibold text-ink text-xl">Overview</h2>
            <p>
              This is the personal portfolio of <span className="text-ink font-medium">Nathan Blatter</span> (nathanblatter.com).
              This policy explains what data is collected when you visit, how it is used, and your rights.
              The short version: very little is collected, nothing is sold, and you are never tracked across sites.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-sans font-semibold text-ink text-xl">Analytics</h2>
            <p>
              This site uses{' '}
              <span className="text-ink font-medium">Umami Analytics</span>, a privacy-focused,
              open-source analytics platform that is self-hosted on personal infrastructure.
              Umami does <span className="text-ink font-medium">not</span> use cookies,
              does not collect personally identifiable information, and does not track you
              across websites.
            </p>
            <p>Each page view records only:</p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-sm">
              <li>Page URL and referrer</li>
              <li>Browser type and operating system (generic)</li>
              <li>Screen size category</li>
              <li>Country (derived from IP, which is not stored)</li>
            </ul>
            <p>
              This data is used solely to understand which content is useful. It is never shared
              with third parties.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-sans font-semibold text-ink text-xl">Cookies &amp; Local Storage</h2>
            <p>
              This site sets <span className="text-ink font-medium">no tracking cookies</span>.
            </p>
            <p>The following data is stored locally in your browser:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-mist">
                    <th className="text-left py-2 pr-4 font-mono text-xs text-blue font-medium">Key</th>
                    <th className="text-left py-2 pr-4 font-mono text-xs text-blue font-medium">Type</th>
                    <th className="text-left py-2 font-mono text-xs text-blue font-medium">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mist">
                  <tr>
                    <td className="py-2.5 pr-4 font-mono text-xs text-ink">theme</td>
                    <td className="py-2.5 pr-4 text-xs">localStorage</td>
                    <td className="py-2.5 text-xs">Remembers your light/dark mode preference</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-mono text-xs text-ink">cookie-consent</td>
                    <td className="py-2.5 pr-4 text-xs">localStorage</td>
                    <td className="py-2.5 text-xs">Records that you dismissed this notice</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 font-mono text-xs text-ink">auth_token</td>
                    <td className="py-2.5 pr-4 text-xs">httpOnly cookie</td>
                    <td className="py-2.5 text-xs">Admin session only — only set if you log into the admin panel. Not accessible to JavaScript. Never set for regular visitors.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-sans font-semibold text-ink text-xl">Contact Form</h2>
            <p>
              If you submit a message via the contact form, your name, email address, and message
              are sent to Nathan Blatter by email. This data is used only to respond to your
              inquiry and is not stored in a database, sold, or shared with anyone.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-sans font-semibold text-ink text-xl">Third-Party Services</h2>
            <div className="space-y-4">
              <div>
                <p className="text-ink font-medium text-sm mb-1">Google Fonts</p>
                <p className="text-sm">
                  This site loads fonts (JetBrains Mono, Instrument Serif, DM Sans) from Google's
                  CDN. When your browser fetches these fonts, Google may log your IP address.
                  See{' '}
                  <a
                    href="https://policies.google.com/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue hover:underline"
                  >
                    Google's Privacy Policy
                  </a>
                  .
                </p>
              </div>
              <div>
                <p className="text-ink font-medium text-sm mb-1">Cloudflare</p>
                <p className="text-sm">
                  This site is served through Cloudflare's network. Cloudflare may process
                  request metadata (IP address, headers) for security and performance. See{' '}
                  <a
                    href="https://www.cloudflare.com/privacypolicy/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue hover:underline"
                  >
                    Cloudflare's Privacy Policy
                  </a>
                  .
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-sans font-semibold text-ink text-xl">Your Rights (GDPR)</h2>
            <p>
              If you are located in the European Economic Area, you have the right to access,
              correct, or request deletion of any personal data held about you. As this site
              collects no persistent personal data from visitors, there is typically nothing
              to provide or delete. For contact form submissions, you may request deletion
              by emailing the address below.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-sans font-semibold text-ink text-xl">Contact</h2>
            <p>
              Questions about this policy:{' '}
              <a href="mailto:nzb22@byu.edu" className="text-blue hover:underline">
                nzb22@byu.edu
              </a>
            </p>
          </section>

        </div>
      </div>
    </section>
  )
}
