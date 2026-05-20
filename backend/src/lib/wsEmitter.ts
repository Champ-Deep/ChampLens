// Simple in-process WebSocket emitter
// The server holds connected WebSocket clients; the worker calls emitCardStatus()

type StatusPayload = { cardId: string; status: string }

const clients = new Set<(payload: StatusPayload) => void>()

export function registerWsClient(fn: (payload: StatusPayload) => void) {
  clients.add(fn)
  return () => clients.delete(fn)
}

export function emitCardStatus(cardId: string, status: string) {
  const payload: StatusPayload = { cardId, status }
  for (const fn of clients) {
    try { fn(payload) } catch {}
  }
}
