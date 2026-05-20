import axios from 'axios'

// VITE_API_URL is the full origin of the ChampLens API service
// (e.g. https://champlens-api.up.railway.app). Empty / unset means same-origin
// — used by docker-compose where nginx proxies /api → backend.
const apiOrigin = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

const api = axios.create({
  baseURL: `${apiOrigin}/api`,
  withCredentials: true,
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// Lazy import to avoid circular dep
let useAuthStore: any
import('@/store/auth').then((m) => { useAuthStore = m.useAuthStore })

export default api
