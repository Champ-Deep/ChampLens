import axios from 'axios'

// VITE_API_URL is the full origin of the ChampLens API service
// (e.g. https://champlens-api.up.railway.app). Empty / unset means same-origin
// (used by docker-compose where nginx proxies /api → backend).
//
// We normalize so that bare-hostname inputs ("champlens-api.up.railway.app")
// don't silently produce a relative URL — axios would otherwise treat that as
// a path on the current origin and every API call would 404.
function normalizeOrigin(raw: string | undefined): string {
  const v = (raw ?? '').trim().replace(/\/+$/, '')
  if (!v) return ''
  if (!/^https?:\/\//i.test(v)) return `https://${v}`
  return v
}
const apiOrigin = normalizeOrigin(import.meta.env.VITE_API_URL)

const api = axios.create({
  baseURL: `${apiOrigin}/api`,
})

// Clerk's getToken() is a hook return — only callable inside React. We wire it
// up at app boot via ApiAuthBinder so axios interceptors can grab a fresh
// session token per request.
let tokenGetter: (() => Promise<string | null>) | null = null
export const setTokenGetter = (fn: () => Promise<string | null>) => {
  tokenGetter = fn
}

api.interceptors.request.use(async (config) => {
  if (tokenGetter) {
    const token = await tokenGetter()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Backend 5xx responses carry a `detail` field with the actual root cause
    // (mongoose error, Clerk failure, etc.). Components only show `message` —
    // log `detail` to the console so it's reachable in DevTools without
    // muddying user-facing copy.
    const detail = err.response?.data?.detail
    if (detail) {
      console.error('[ChampLens API]', err.response.status, err.config?.method?.toUpperCase(), err.config?.url, '—', detail)
    }
    if (err.response?.status === 401) {
      // Let Clerk handle redirect via <Show when="signed-out"> / <RedirectToSignIn />.
      // No store to clear — Clerk manages session.
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
