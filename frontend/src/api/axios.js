import axios from 'axios'
import {
  API_BASE_URL,
  REFRESH_TOKEN_KEY,
  REMEMBER_ME_KEY,
  TOKEN_KEY,
  USER_KEY,
} from '@/utils/constants'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

let onUnauthorized = null

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

function getStorage() {
  const rememberMe = localStorage.getItem(REMEMBER_ME_KEY) === 'true'
  return rememberMe ? localStorage : sessionStorage
}

function getToken(key) {
  return localStorage.getItem(key) || sessionStorage.getItem(key)
}

function clearTokens() {
  ;[localStorage, sessionStorage].forEach((storage) => {
    storage.removeItem(TOKEN_KEY)
    storage.removeItem(REFRESH_TOKEN_KEY)
    storage.removeItem(USER_KEY)
  })
  localStorage.removeItem(REMEMBER_ME_KEY)
}

function isPublicQueueRequest(config) {
  const path = `${config.url || ''}`
  return /\/queue\/?(\?|$)/.test(path)
}

api.interceptors.request.use((config) => {
  const token = getToken(TOKEN_KEY)
  if (token && !isPublicQueueRequest(config)) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      const refreshToken = getToken(REFRESH_TOKEN_KEY)

      if (refreshToken) {
        try {
          const { data: body } = await axios.post(
            `${API_BASE_URL}/auth/token/refresh/`,
            { refresh: refreshToken },
          )
          const access = body.data?.access ?? body.access
          getStorage().setItem(TOKEN_KEY, access)
          originalRequest.headers.Authorization = `Bearer ${access}`
          return api(originalRequest)
        } catch {
          clearTokens()
          onUnauthorized?.()
        }
      } else {
        clearTokens()
        onUnauthorized?.()
      }
    }

    return Promise.reject(error)
  },
)

export { clearTokens, getStorage, getToken }
export default api
