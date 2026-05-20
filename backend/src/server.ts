import 'dotenv/config'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import websocket from '@fastify/websocket'
import mongoose from 'mongoose'
import path from 'path'
import fs from 'fs'

import authRoutes from './routes/auth'
import cardRoutes from './routes/cards'
import analyticsRoutes from './routes/analytics'
import fileRoutes from './routes/files'
import adminRoutes from './routes/admin'
import { seedAdmin } from './lib/seedAdmin'
import { registerWsClient } from './lib/wsEmitter'

const app = Fastify({ logger: { level: process.env.NODE_ENV === 'production' ? 'warn' : 'info' } })

// ── Plugins ───────────────────────────────────────────────────────────────────

app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      mediaSrc: ["'self'", 'blob:', 'https:'],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", 'https:'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
    },
  },
})

// FRONTEND_URL accepts comma-separated origins so Railway's <service>.up.railway.app
// AND any custom domain both pass CORS preflight.
const corsOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

app.register(cors, {
  origin: corsOrigins.length > 1 ? corsOrigins : corsOrigins[0],
  credentials: true,
})

app.register(cookie, { secret: process.env.JWT_SECRET ?? 'dev-secret' })

app.register(rateLimit, {
  global: true,
  max: 200,
  timeWindow: '1 minute',
})

app.register(multipart, {
  limits: {
    fileSize: 200 * 1024 * 1024,  // 200 MB per file
    files: 2,                      // video + optional audio
  },
})

app.register(websocket)

// ── Static file serving (GridFS served via /files route) ──────────────────────
const uploadsDir = path.join(__dirname, '..', 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

// ── Routes ────────────────────────────────────────────────────────────────────

app.register(authRoutes, { prefix: '/api/auth' })
app.register(cardRoutes, { prefix: '/api/cards' })
app.register(analyticsRoutes, { prefix: '/api/analytics' })
app.register(adminRoutes, { prefix: '/api/admin' })
app.register(fileRoutes, { prefix: '/files' })

// WebSocket endpoint for card processing status
app.register(async (wsApp) => {
  wsApp.get('/ws', { websocket: true }, (socket) => {
    const unregister = registerWsClient((payload) => {
      if (socket.readyState === 1) {
        socket.send(JSON.stringify(payload))
      }
    })
    socket.on('close', unregister)
  })
})

// Health check
app.get('/health', async () => ({ ok: true, ts: Date.now() }))

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const start = async () => {
  const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/champlens'
  await mongoose.connect(MONGODB_URI)
  app.log.info('MongoDB connected')
  await seedAdmin()

  const port = Number(process.env.PORT ?? 3001)
  await app.listen({ port, host: '0.0.0.0' })
  app.log.info(`Server running on port ${port}`)
}

start().catch((err) => { console.error(err); process.exit(1) })

export { app }
