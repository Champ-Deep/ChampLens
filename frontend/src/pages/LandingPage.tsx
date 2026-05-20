import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { QrCode, Scan, Play, Download, ChevronRight, Zap, Shield, Globe } from 'lucide-react'

const fadeUp = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true } }

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-bg-base/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <QrCode className="w-6 h-6 text-accent" />
            <span className="font-bold text-lg tracking-tight">ChampLens</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-text-secondary hover:text-white transition-colors">Sign in</Link>
            <Link to="/register" className="btn-primary text-sm">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative">
          <motion.div {...fadeUp} transition={{ duration: 0.4 }}>
            <span className="inline-flex items-center gap-2 text-xs font-medium text-accent border border-accent/30 bg-accent/5 px-3 py-1.5 rounded-full mb-6">
              <Zap className="w-3 h-3" />
              AR-powered business cards. No app required.
            </span>
          </motion.div>

          <motion.h1
            {...fadeUp}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight mb-6"
          >
            Your card.<br />
            <span className="text-accent">Comes alive.</span>
          </motion.h1>

          <motion.p
            {...fadeUp}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-lg text-text-secondary max-w-xl mx-auto mb-10"
          >
            Upload a video, get a print-ready QR code. When someone scans it, your intro video plays directly on the card in augmented reality — no app, no friction.
          </motion.p>

          <motion.div
            {...fadeUp}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link to="/register" className="btn-primary flex items-center gap-2 text-base px-8 py-3">
              Create Your Card
              <ChevronRight className="w-4 h-4" />
            </Link>
            <Link to="/login" className="btn-ghost text-base px-8 py-3">
              Sign In
            </Link>
          </motion.div>
        </div>

        {/* Hero visual */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="max-w-2xl mx-auto mt-20"
        >
          <div className="panel p-1 shadow-glow-lg">
            <div className="bg-bg-surface rounded aspect-video flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-transparent" />
              <div className="text-center relative z-10">
                <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glow">
                  <QrCode className="w-16 h-16 text-black" />
                </div>
                <p className="text-sm text-text-secondary">Scan → Watch → Connect</p>
              </div>
              {/* Floating video badge */}
              <div className="absolute bottom-4 right-4 bg-accent rounded-lg px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium">
                <Play className="w-3 h-3" />
                Playing on card
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6 bg-bg-surface">
        <div className="max-w-5xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">How it works</h2>
            <p className="text-text-secondary">Three steps from upload to AR experience.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                icon: Play,
                title: 'Upload your video',
                desc: 'Record a 60-second intro. Upload MP4, MOV, or WebM. Fill in your name, title, and links.',
              },
              {
                step: '02',
                icon: Download,
                title: 'Get your QR package',
                desc: 'We generate a print-ready QR code with the Champions Group brand mark. Download your ZIP — PNG, SVG, card mockup, and sticker sheet.',
              },
              {
                step: '03',
                icon: Scan,
                title: 'Hand it out',
                desc: 'Print the QR on your business card. Anyone who scans it sees your video playing live on the card in AR.',
              },
            ].map(({ step, icon: Icon, title, desc }, i) => (
              <motion.div
                key={step}
                {...fadeUp}
                transition={{ delay: i * 0.1 }}
                className="panel p-6 relative overflow-hidden"
              >
                <div className="absolute top-4 right-4 text-4xl font-bold text-text-disabled/20 font-mono">{step}</div>
                <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-accent" />
                </div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Built for professionals</h2>
            <p className="text-text-secondary">Everything you need, nothing you don't.</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: QrCode, title: 'QR IS the AR Marker', desc: 'The same QR you print is tracked by the AR engine. No extra setup.' },
              { icon: Zap, title: 'Zero App Install', desc: 'Recipient scans with the native camera. Browser opens. Video plays. Done.' },
              { icon: Download, title: 'Print-Ready Package', desc: '300 DPI PNG, SVG, card mockup, and sticker sheet — ready for any print shop.' },
              { icon: Play, title: 'Real-Time AR Tracking', desc: 'Video follows every tilt and rotation of the card at 25–30 fps.' },
              { icon: Globe, title: 'Scan Analytics', desc: 'See who scanned, when, from where, and on what device.' },
              { icon: Shield, title: 'Secure by Design', desc: 'Hashed IPs, rate-limited endpoints, httpOnly JWT cookies.' },
            ].map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={title}
                {...fadeUp}
                transition={{ delay: i * 0.07 }}
                className="panel p-5 hover:border-border-hover transition-colors"
              >
                <div className="w-8 h-8 bg-accent/10 rounded flex items-center justify-center mb-3">
                  <Icon className="w-4 h-4 text-accent" />
                </div>
                <h3 className="font-semibold text-sm mb-1">{title}</h3>
                <p className="text-text-secondary text-xs leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="py-24 px-6 bg-bg-surface">
        <div className="max-w-5xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Who's it for?</h2>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              'Executives & Professionals',
              'Real Estate Agents',
              'Creators & Influencers',
              'Startups & Brands',
              'Event Speakers',
              'Sales Teams',
            ].map((label, i) => (
              <motion.div
                key={label}
                {...fadeUp}
                transition={{ delay: i * 0.06 }}
                className="panel p-4 text-sm font-medium text-center hover:border-accent/40 transition-colors"
              >
                {label}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 px-6 text-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent/5 rounded-full blur-3xl pointer-events-none" />
        <motion.div {...fadeUp} className="relative">
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            Make your card<br />unforgettable.
          </h2>
          <p className="text-text-secondary mb-8 max-w-sm mx-auto">
            Join professionals using ChampLens to stand out at every handshake.
          </p>
          <Link to="/register" className="btn-primary text-base px-10 py-3 inline-flex items-center gap-2">
            Get Started Free
            <ChevronRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-accent" />
            <span className="font-bold text-sm">ChampLens</span>
            <span className="text-text-secondary text-xs ml-2">by Champions Group</span>
          </div>
          <p className="text-xs text-text-secondary">© {new Date().getFullYear()} Champions Group. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
