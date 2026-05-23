import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { QrCode } from 'lucide-react'
import { SignIn } from '@clerk/clerk-react'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <QrCode className="w-8 h-8 text-accent" />
            <span className="text-2xl font-bold">ChampLens</span>
          </Link>
        </div>

        <SignIn
          routing="path"
          path="/login"
          signUpUrl="/register"
          forceRedirectUrl="/dashboard"
          appearance={{ elements: { rootBox: 'mx-auto', card: 'shadow-glow' } }}
        />
      </motion.div>
    </div>
  )
}
