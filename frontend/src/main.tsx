import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import App from './App'
import './index.css'

// Fail loudly at boot if the publishable key is missing — easier to spot than
// the cryptic error Clerk throws from inside the provider.
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
if (!PUBLISHABLE_KEY) {
  throw new Error('VITE_CLERK_PUBLISHABLE_KEY is not set — set it as a Build Arg on the Railway frontend service.')
}

// Note: Clerk's React quickstart docs prefer auto-detection via
// VITE_CLERK_PUBLISHABLE_KEY, but @clerk/react@6's types still mark
// publishableKey as required, so we pass it explicitly.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <App />
    </ClerkProvider>
  </React.StrictMode>
)
