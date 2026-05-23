import { useEffect, useRef, useState } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (payload: any) => void

const handlers = new Map<string, Set<Handler>>()
let ws: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

function getWsUrl() {
  // Tolerate VITE_API_URL with or without protocol prefix. Without this guard,
  // a bare hostname like "champlens-api.up.railway.app" produces a relative
  // URL that the browser resolves against the current page — landing at
  // wss://<frontend>/<api-host>/ws and looping on connect failure.
  const raw = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '')
  if (raw) {
    const isLocal = /^http:\/\//i.test(raw)
    const host = raw.replace(/^https?:\/\//i, '')
    return `${isLocal ? 'ws' : 'wss'}://${host}/ws`
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws`
}

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return

  ws = new WebSocket(getWsUrl())

  ws.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data)
      const set = handlers.get('card:status')
      if (set) set.forEach((fn) => fn(payload))
    } catch {}
  }

  ws.onclose = () => {
    ws = null
    if (reconnectTimer) clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(connect, 3000)
  }

  ws.onerror = () => {
    ws?.close()
  }
}

export function useSocket() {
  const [connected, setConnected] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    connect()

    const interval = setInterval(() => {
      if (mountedRef.current) setConnected(ws?.readyState === WebSocket.OPEN)
    }, 1000)

    return () => {
      mountedRef.current = false
      clearInterval(interval)
    }
  }, [])

  return {
    on: (event: string, fn: Handler) => {
      if (!handlers.has(event)) handlers.set(event, new Set())
      handlers.get(event)!.add(fn)
    },
    off: (event: string, fn: Handler) => {
      handlers.get(event)?.delete(fn)
    },
    connected,
  }
}
