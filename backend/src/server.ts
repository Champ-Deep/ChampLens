import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import websocket from '@fastify/websocket'
import { clerkPlugin } from '@clerk/fastify'
import mongoose from 'mongoose'
import path from 'path'
import fs from 'fs'

import authRoutes from './routes/auth'
import cardRoutes from './routes/cards'
import analyticsRoutes from './routes/analytics'
import fileRoutes from './routes/files'
import adminRoutes from './routes/admin'
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

// Clerk plugin — verifies the Bearer session token sent by the frontend
// and exposes getAuth(req) for route handlers and preHandlers.
//
// Gated on env vars: Fastify loads registered plugins as part of `app.listen()`.
// If Clerk throws during init (missing keys, network blip fetching JWKS), listen
// rejects and the process exits before binding the port — Railway's healthcheck
// then sees connection refused and the deploy fails. Skipping registration when
// keys are absent keeps /health responsive while making the misconfig obvious in
// logs. Auth routes will 503 in that state (see lib/auth.ts).
if (process.env.CLERK_SECRET_KEY) {
  app.register(clerkPlugin, {
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  })
} else {
  app.log.warn('CLERK_SECRET_KEY not set — Clerk plugin skipped; /api auth routes will 503 until configured')
}

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

// ── Error handler ─────────────────────────────────────────────────────────────
// Fastify swallows error stacks in production by default; surface them in logs
// AND echo the message in the response body so 500s aren't opaque in the browser.
app.setErrorHandler((error, req, reply) => {
  req.log.error(
    { err: error.message, stack: error.stack, url: req.url, method: req.method },
    'route handler threw'
  )
  const status = (error as any).statusCode && (error as any).statusCode >= 400 ? (error as any).statusCode : 500
  reply.code(status).send({
    message: error.message ?? 'Internal Server Error',
    code: (error as any).code,
  })
})

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

// Liveness: returns 200 as soon as the HTTP server is up, regardless of
// MongoDB readiness. Railway's healthcheck hits this — gating it on the DB
// would cause healthcheck failures whenever Mongo cold-starts slowly.
app.get('/health', async () => ({ ok: true, ts: Date.now() }))

// Readiness: returns 200 only when MongoDB has connected. Use this for
// downstream callers that need to know the API can actually serve data.
app.get('/health/ready', async (_req, reply) => {
  const ready = mongoose.connection.readyState === 1
  return reply.code(ready ? 200 : 503).send({ ready, mongo: mongoose.connection.readyState })
})

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const start = async () => {
  // Listen on $PORT FIRST so Railway's healthcheck succeeds quickly. Connect
  // to dependencies in the background — failures are logged, not fatal.
  const port = Number(process.env.PORT ?? 3001)
  await app.listen({ port, host: '0.0.0.0' })
  app.log.info(`Server running on port ${port}`)

  // Loud error if MONGODB_URI is missing in production — silently falling back
  // to localhost would just produce an endless retry loop with no clear cause.
  if (!process.env.MONGODB_URI) {
    if (process.env.NODE_ENV === 'production') {
      app.log.error(
        'MONGODB_URI is NOT set. On Railway, set it to ${{Mongo.MONGO_URL}} ' +
        '(or your Mongo service name, e.g. ${{champlens-mongo.MONGO_URL}}). ' +
        'Falling back to localhost — this will fail.'
      )
    } else {
      app.log.warn('MONGODB_URI not set; using localhost default')
    }
  }
  const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/champlens'
  // Mask credentials before logging the URI host so we know which Mongo we resolved to.
  const maskedUri = MONGODB_URI.replace(/\/\/([^@]+)@/, '//***@')
  app.log.info({ mongo: maskedUri }, 'Connecting to MongoDB')

  const connectWithRetry = async () => {
    for (let attempt = 1; ; attempt++) {
      try {
        await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10_000 })
        app.log.info('MongoDB connected')
        return
      } catch (err) {
        app.log.error({ err: (err as Error).message, attempt }, 'MongoDB connection failed; retrying in 10s')
        await new Promise((r) => setTimeout(r, 10_000))
      }
    }
  }
  void connectWithRetry()
}

start().catch((err) => { console.error(err); process.exit(1) })

export { app }
