import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Send, MapPin, ArrowUpRight, Calendar, Clock, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import SectionHeader from '../components/SectionHeader'
import { api, type SocialResponse, type ContactMetaResponse, type ContactSubmitRequest, type AvailableSlot, type BookingSettingsResponse } from '../lib/api'
import { getIcon } from '../lib/iconMap'

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatSlotTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function formatDateLabel(d: Date): string {
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`
}

function BookACall() {
  const [bookingSettings, setBookingSettings] = useState<BookingSettingsResponse | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [slots, setSlots] = useState<AvailableSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedDuration, setSelectedDuration] = useState<number>(30)
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null)
  const [bookingForm, setBookingForm] = useState({ name: '', email: '', topic: '', honeypot: '' })
  const [bookingSubmitted, setBookingSubmitted] = useState(false)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [dateOffset, setDateOffset] = useState(0)

  useEffect(() => {
    api.bookings.settingsPublic().then(setBookingSettings).catch(() => {})
  }, [])

  const dates = useMemo(() => {
    const result: Date[] = []
    const today = new Date()
    for (let i = 0; i < 14; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      result.push(d)
    }
    return result
  }, [])

  const visibleDates = dates.slice(dateOffset, dateOffset + 7)

  useEffect(() => {
    if (!selectedDate) return
    setSlotsLoading(true)
    api.bookings.slots(selectedDate)
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false))
  }, [selectedDate])

  const filteredSlots = slots.filter(s => s.durations.includes(selectedDuration))
  const availableDurations = useMemo(() => {
    const set = new Set<number>()
    slots.forEach(s => s.durations.forEach(d => set.add(d)))
    return Array.from(set).sort((a, b) => a - b)
  }, [slots])

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSlot) return
    setBookingLoading(true)
    setBookingError(null)
    try {
      await api.bookings.create({
        visitor_name: bookingForm.name,
        visitor_email: bookingForm.email,
        topic: bookingForm.topic,
        start_at: selectedSlot.start,
        duration_minutes: selectedDuration,
        honeypot: bookingForm.honeypot || undefined,
      })
      setBookingSubmitted(true)
    } catch {
      setBookingError('Something went wrong. Please try again.')
    } finally {
      setBookingLoading(false)
    }
  }

  if (!bookingSettings?.enabled) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="mt-20"
    >
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-blue-wash flex items-center justify-center">
          <Calendar size={18} className="text-blue" />
        </div>
        <div>
          <h3 className="font-sans font-semibold text-ink text-xl">Book a Call</h3>
          <p className="text-steel text-sm">Pick a time and I'll get back to you within 48 hours.</p>
        </div>
      </div>

      {bookingSubmitted ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center text-center p-10 rounded-2xl border border-teal/20 bg-teal/[0.03]"
        >
          <div className="w-16 h-16 rounded-full bg-teal/10 flex items-center justify-center mb-4">
            <Check size={24} className="text-teal" />
          </div>
          <h3 className="font-sans font-semibold text-ink text-xl mb-2">Request sent!</h3>
          <p className="text-steel text-sm max-w-md">
            Nathan will review your request and you'll hear back by email.
            If accepted, you'll receive a Zoom link and calendar invite.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {/* Date picker strip */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-xs text-steel tracking-wider uppercase">Select a date</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setDateOffset(Math.max(0, dateOffset - 7))}
                  disabled={dateOffset === 0}
                  className="p-1.5 rounded-lg text-steel hover:text-ink hover:bg-cloud disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setDateOffset(Math.min(7, dateOffset + 7))}
                  disabled={dateOffset >= 7}
                  className="p-1.5 rounded-lg text-steel hover:text-ink hover:bg-cloud disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {visibleDates.map(d => {
                const dateStr = d.toISOString().split('T')[0]
                const isToday = dateStr === new Date().toISOString().split('T')[0]
                const isSelected = dateStr === selectedDate
                return (
                  <button
                    key={dateStr}
                    onClick={() => { setSelectedDate(dateStr); setSelectedSlot(null) }}
                    className={`flex flex-col items-center py-3 px-2 rounded-xl border transition-all text-center ${
                      isSelected
                        ? 'border-blue bg-blue-wash text-blue'
                        : isToday
                        ? 'border-blue/30 bg-snow text-ink hover:border-blue/50'
                        : 'border-mist bg-snow text-ink hover:border-blue/30'
                    }`}
                  >
                    <span className="font-mono text-[10px] text-steel tracking-wider uppercase">{DAY_NAMES[d.getDay() === 0 ? 6 : d.getDay() - 1]}</span>
                    <span className="text-lg font-semibold mt-0.5">{d.getDate()}</span>
                    <span className="font-mono text-[10px] text-steel">{MONTH_NAMES[d.getMonth()]}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Time slots */}
          <AnimatePresence mode="wait">
            {selectedDate && (
              <motion.div
                key={selectedDate}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* Duration toggle */}
                {availableDurations.length > 1 && (
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-steel" />
                    <span className="font-mono text-xs text-steel mr-2">Duration:</span>
                    {availableDurations.map(dur => (
                      <button
                        key={dur}
                        onClick={() => { setSelectedDuration(dur); setSelectedSlot(null) }}
                        className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-all ${
                          selectedDuration === dur
                            ? 'bg-blue text-white'
                            : 'bg-cloud text-steel hover:text-ink'
                        }`}
                      >
                        {dur} min
                      </button>
                    ))}
                  </div>
                )}

                {slotsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-5 h-5 border-2 border-blue/30 border-t-blue rounded-full animate-spin" />
                  </div>
                ) : filteredSlots.length === 0 ? (
                  <p className="text-steel text-sm text-center py-8">No available slots on this date.</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {filteredSlots.map(slot => {
                      const isSelected = selectedSlot?.start === slot.start
                      return (
                        <button
                          key={slot.start}
                          onClick={() => setSelectedSlot(slot)}
                          className={`py-2.5 px-3 rounded-xl border font-mono text-sm transition-all ${
                            isSelected
                              ? 'border-blue bg-blue text-white shadow-lg shadow-blue/20'
                              : 'border-mist bg-snow text-ink hover:border-blue/30 hover:shadow-md'
                          }`}
                        >
                          {formatSlotTime(slot.start)}
                        </button>
                      )
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Booking form */}
          <AnimatePresence>
            {selectedSlot && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
                onSubmit={handleBookingSubmit}
              >
                <div className="p-6 rounded-2xl border border-mist bg-snow space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar size={14} className="text-blue" />
                    <span className="text-sm text-ink font-medium">
                      {new Date(selectedSlot.start).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
                    </span>
                    <span className="text-sm text-steel">at</span>
                    <span className="text-sm text-ink font-medium">{formatSlotTime(selectedSlot.start)}</span>
                    <span className="font-mono text-xs text-steel">({selectedDuration} min)</span>
                  </div>

                  {/* Honeypot */}
                  <div style={{ display: 'none' }} aria-hidden="true">
                    <input
                      type="text"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                      value={bookingForm.honeypot}
                      onChange={e => setBookingForm({ ...bookingForm, honeypot: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-mono text-xs text-steel mb-2 tracking-wider uppercase">Name</label>
                      <input
                        type="text"
                        required
                        value={bookingForm.name}
                        onChange={e => setBookingForm({ ...bookingForm, name: e.target.value })}
                        className="w-full px-4 py-3 bg-white border border-mist rounded-xl text-ink text-sm placeholder-silver focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="block font-mono text-xs text-steel mb-2 tracking-wider uppercase">Email</label>
                      <input
                        type="email"
                        required
                        value={bookingForm.email}
                        onChange={e => setBookingForm({ ...bookingForm, email: e.target.value })}
                        className="w-full px-4 py-3 bg-white border border-mist rounded-xl text-ink text-sm placeholder-silver focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all"
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-mono text-xs text-steel mb-2 tracking-wider uppercase">Topic</label>
                    <textarea
                      required
                      minLength={5}
                      rows={3}
                      value={bookingForm.topic}
                      onChange={e => setBookingForm({ ...bookingForm, topic: e.target.value })}
                      className="w-full px-4 py-3 bg-white border border-mist rounded-xl text-ink text-sm placeholder-silver focus:outline-none focus:border-blue/50 focus:ring-2 focus:ring-blue/10 transition-all resize-none"
                      placeholder="What would you like to discuss?"
                    />
                  </div>

                  {bookingError && (
                    <p className="font-mono text-xs text-red-500">{bookingError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={bookingLoading}
                    className="group w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-blue text-white font-mono text-sm font-semibold rounded-xl hover:bg-blue-dim transition-colors shadow-lg shadow-blue/20 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {bookingLoading ? 'Requesting...' : 'Request Call'}
                    {!bookingLoading && <Calendar size={14} className="group-hover:scale-110 transition-transform" />}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  )
}

export default function Contact() {
  const [socials, setSocials] = useState<SocialResponse[]>([])
  const [meta, setMeta] = useState<ContactMetaResponse | null>(null)
  const [formData, setFormData] = useState<ContactSubmitRequest>({ name: '', email: '', message: '', honeypot: '' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.contactPage.get()
      .then(({ meta: m, socials: s }) => { setMeta(m); setSocials(s) })
      .catch(() => {})
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
                  onClick={() => { setSubmitted(false); setFormData({ name: '', email: '', message: '', honeypot: '' }); setError(null); }}
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
                    minLength={10}
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

        {/* Book a Call section */}
        <BookACall />
      </div>
    </section>
  )
}
