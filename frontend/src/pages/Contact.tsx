import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { Send, MapPin, ArrowUpRight } from 'lucide-react'
import SectionHeader from '../components/SectionHeader'
import { api, type SocialResponse, type ContactMetaResponse, type ContactSubmitRequest } from '../lib/api'
import { getIcon } from '../lib/iconMap'

export default function Contact() {
  const [socials, setSocials] = useState<SocialResponse[]>([])
  const [meta, setMeta] = useState<ContactMetaResponse | null>(null)
  const [formData, setFormData] = useState<ContactSubmitRequest>({ name: '', email: '', message: '', honeypot: '' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([api.socials.list(), api.contact.get()])
      .then(([s, m]) => { setSocials(s); setMeta(m) })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api.contact.submit(formData)
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="py-16 md:py-28 min-h-screen">
      <div className="max-w-[900px] w-full mx-auto px-6">
        <SectionHeader
          code="// CONTACT"
          title={meta?.heading ?? 'Get in Touch'}
          subtitle={meta?.subheading ?? 'Have a project idea, opportunity, or just want to say hi?'}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16">
          {/* Left - Contact info */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-8"
          >
            <div>
              <h3 className="font-sans font-semibold text-ink text-xl mb-3">Let's connect</h3>
              {meta?.body_text && (
                <p className="text-steel leading-relaxed">{meta.body_text}</p>
              )}
            </div>

            <div className="space-y-3">
              {socials.map((social, i) => {
                const Icon = getIcon(social.icon)
                return (
                  <motion.a
                    key={social.id}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    className="group flex items-center gap-4 p-4 rounded-xl border border-mist bg-snow hover:border-blue/30 hover:shadow-lg hover:shadow-blue/5 transition-all"
                  >
                    <div className="w-10 h-10 rounded-xl bg-cloud flex items-center justify-center group-hover:bg-blue-wash transition-colors">
                      <Icon size={18} className="text-steel group-hover:text-blue transition-colors" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-ink">{social.label}</p>
                      <p className="text-xs text-steel font-mono mt-0.5">{social.handle}</p>
                    </div>
                    <ArrowUpRight size={14} className="text-silver group-hover:text-blue transition-colors" />
                  </motion.a>
                )
              })}
            </div>

            {meta?.location_text && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="flex items-center gap-3 pt-2"
              >
                <MapPin size={14} className="text-blue" />
                <span className="font-mono text-xs text-steel">{meta.location_text}</span>
              </motion.div>
            )}
          </motion.div>

          {/* Right - Contact form */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="h-full flex flex-col items-center justify-center text-center p-10 rounded-2xl border border-teal/20 bg-teal/[0.03]"
              >
                <div className="w-16 h-16 rounded-full bg-teal/10 flex items-center justify-center mb-4">
                  <Send size={24} className="text-teal" />
                </div>
                <h3 className="font-sans font-semibold text-ink text-xl mb-2">Message sent!</h3>
                <p className="text-steel text-sm">Thanks for reaching out. I'll get back to you soon.</p>
                <button
                  onClick={() => { setSubmitted(false); setFormData({ name: '', email: '', message: '' }); setError(null); }}
                  className="mt-6 font-mono text-xs text-steel hover:text-blue transition-colors"
                >
                  Send another message
                </button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Honeypot — hidden from real users, bots fill it out */}
                <div style={{ display: 'none' }} aria-hidden="true">
                  <input
                    type="text"
                    name="honeypot"
                    tabIndex={-1}
                    autoComplete="off"
                    value={formData.honeypot}
                    onChange={(e) => setFormData({ ...formData, honeypot: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs text-steel mb-2 tracking-wider uppercase">Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-snow border border-mist rounded-xl text-ink text-sm placeholder-silver focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs text-steel mb-2 tracking-wider uppercase">Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-snow border border-mist rounded-xl text-ink text-sm placeholder-silver focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs text-steel mb-2 tracking-wider uppercase">Message</label>
                  <textarea
                    required
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-4 py-3 bg-snow border border-mist rounded-xl text-ink text-sm placeholder-silver focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all resize-none"
                    placeholder="Tell me about your project or opportunity..."
                  />
                </div>
                {error && (
                  <p className="font-mono text-xs text-red-500">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="group w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-blue text-white font-mono text-sm font-semibold rounded-xl hover:bg-blue-dim transition-colors shadow-lg shadow-blue/20 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? 'Sending...' : 'Send Message'}
                  {!loading && <Send size={14} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
