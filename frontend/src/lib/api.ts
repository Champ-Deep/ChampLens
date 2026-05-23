import axios from 'axios'

// VITE_API_URL is the full origin of the ChampLens API service
// (e.g. https://champlens-api.up.railway.app). Empty / unset means same-origin.
const apiOrigin = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

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
    if (err.response?.status === 401) {
      // Let Clerk handle redirect via <Show when="signed-out"> / <RedirectToSignIn />.
      // No store to clear — Clerk manages session.
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
