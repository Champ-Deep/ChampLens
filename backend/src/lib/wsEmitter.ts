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

type StatusPayload = Record<string, string>

const CARD_CHANNEL = 'card:status'
const CAMPAIGN_CHANNEL = 'campaign:status'

// In-process subscribers (the API's /ws endpoint registers a callback here on
// each new browser connection).
const clients = new Set<(payload: StatusPayload) => void>()

export function registerWsClient(fn: (payload: StatusPayload) => void) {
  clients.add(fn)
  return () => clients.delete(fn)
}

/** Fan out to in-process WS clients. */
function broadcastToClients(payload: StatusPayload) {
  for (const fn of clients) {
    try { fn(payload) } catch { /* never let a bad listener block the others */ }
  }
}

/** Fan out card status to WS clients. Called by the Redis subscriber. */
export function emitCardStatus(cardId: string, status: string) {
  broadcastToClients({ type: 'card:status', cardId, status })
}

/** Fan out campaign status to WS clients. Called by the Redis subscriber. */
export function emitCampaignStatus(campaignId: string, status: string) {
  broadcastToClients({ type: 'campaign:status', campaignId, status })
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

/** Publish a card-status update across processes. Fire-and-forget. */
export function publishCardStatus(cardId: string, status: string): void {
  getPublisher()
    .publish(CARD_CHANNEL, JSON.stringify({ cardId, status }))
    .catch((err) => console.error('[wsEmitter] publish failed:', err.message))
}

/** Publish a campaign-status update across processes. Fire-and-forget. */
export function publishCampaignStatus(campaignId: string, status: string): void {
  getPublisher()
    .publish(CAMPAIGN_CHANNEL, JSON.stringify({ campaignId, status }))
    .catch((err) => console.error('[wsEmitter] publish failed:', err.message))
}

let subscribed = false

/** Subscribe to both card and campaign status channels and route to WS clients.
 *  Idempotent. Call once on API boot. */
export function subscribeCardStatus(): void {
  if (subscribed) return
  subscribed = true
  const subscriber = newRedisClient('subscriber')
  subscriber.subscribe(CARD_CHANNEL, CAMPAIGN_CHANNEL, (err) => {
    if (err) {
      console.error('[wsEmitter] subscribe failed:', err.message)
      subscribed = false
      return
    }
    console.log(`[wsEmitter] subscribed to Redis channels '${CARD_CHANNEL}', '${CAMPAIGN_CHANNEL}'`)
  })
  subscriber.on('message', (channel, message) => {
    try {
      const payload = JSON.parse(message)
      if (channel === CARD_CHANNEL && payload?.cardId && payload?.status) {
        emitCardStatus(payload.cardId, payload.status)
      } else if (channel === CAMPAIGN_CHANNEL && payload?.campaignId && payload?.status) {
        emitCampaignStatus(payload.campaignId, payload.status)
      }
    } catch {
      console.error('[wsEmitter] discarded malformed pub/sub message:', message)
    }
  })
}
