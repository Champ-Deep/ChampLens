// Card-processing status emitter — bridges API and Worker via Redis pub/sub.
//
// API and Worker run in separate Node processes in production (separate Railway
// services). The in-process `clients` Set only fans out to WS clients connected
// to THIS process — so the worker's status updates would never reach the
// browser unless we bridge the two processes.
//
// Flow:
//   Worker → publishCardStatus → Redis channel `card:status`
//   API    → subscribeCardStatus (on boot) → emitCardStatus → WS clients → browser
//
// In single-process local dev, the same path applies (publish then subscribe
// back through Redis). That keeps prod and dev behaviorally identical and
// avoids a feedback-loop variant where one process both publishes and locally
// emits.

import IORedis from 'ioredis'

type StatusPayload = { cardId: string; status: string }

const CHANNEL = 'card:status'

// In-process subscribers (the API's /ws endpoint registers a callback here on
// each new browser connection).
const clients = new Set<(payload: StatusPayload) => void>()

export function registerWsClient(fn: (payload: StatusPayload) => void) {
  clients.add(fn)
  return () => clients.delete(fn)
}

/** Fan out to in-process WS clients. Called by the Redis subscriber when a
 *  message arrives. Don't call this directly from the worker — use
 *  publishCardStatus so the message can cross process boundaries. */
export function emitCardStatus(cardId: string, status: string) {
  const payload: StatusPayload = { cardId, status }
  for (const fn of clients) {
    try { fn(payload) } catch { /* never let a bad listener block the others */ }
  }
}

function newRedisClient(role: 'publisher' | 'subscriber'): IORedis {
  // maxRetriesPerRequest: null matches BullMQ's recommendation — subscribe is a
  // blocking command and we want ioredis to keep retrying through reconnects.
  const opts = { maxRetriesPerRequest: null as null }
  const client = process.env.REDIS_URL
    ? new IORedis(process.env.REDIS_URL, opts)
    : new IORedis({
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
        ...opts,
      })
  client.on('error', (err) => {
    console.error(`[wsEmitter] Redis ${role} error:`, err.message)
  })
  return client
}

// Publisher and subscriber must be separate connections in Redis — once a
// connection enters subscribe mode it can't run other commands.
let publisher: IORedis | null = null
function getPublisher(): IORedis {
  if (!publisher) publisher = newRedisClient('publisher')
  return publisher
}

/** Publish a card-status update across processes. Fire-and-forget; failures
 *  are logged but don't propagate, so the worker pipeline isn't gated on
 *  Redis being healthy. */
export function publishCardStatus(cardId: string, status: string): void {
  const payload: StatusPayload = { cardId, status }
  getPublisher()
    .publish(CHANNEL, JSON.stringify(payload))
    .catch((err) => console.error('[wsEmitter] publish failed:', err.message))
}

let subscribed = false

/** Subscribe to the cross-process status channel and route messages to local
 *  WS clients. Idempotent. Call once on API boot. */
export function subscribeCardStatus(): void {
  if (subscribed) return
  subscribed = true
  const subscriber = newRedisClient('subscriber')
  subscriber.subscribe(CHANNEL, (err) => {
    if (err) {
      console.error('[wsEmitter] subscribe failed:', err.message)
      subscribed = false // allow a future retry
      return
    }
    console.log(`[wsEmitter] subscribed to Redis channel '${CHANNEL}'`)
  })
  subscriber.on('message', (channel, message) => {
    if (channel !== CHANNEL) return
    try {
      const payload = JSON.parse(message) as StatusPayload
      if (payload && typeof payload.cardId === 'string' && typeof payload.status === 'string') {
        emitCardStatus(payload.cardId, payload.status)
      }
    } catch {
      console.error('[wsEmitter] discarded malformed pub/sub message:', message)
    }
  })
}
