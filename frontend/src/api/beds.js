import api from './axios'
import { getApiErrorMessage } from '@/utils/errors'

export function getBedsErrorMessage(error, fallback = 'Something went wrong.') {
  const status = error.response?.status
  if (status === 500) return 'Server error. Please try again.'
  return getApiErrorMessage(error, fallback)
}

const getInFlight = new Map()

function cacheKey(url, params) {
  if (!params) return url
  const normalized = {}
  for (const key of Object.keys(params).sort()) {
    const value = params[key]
    if (value === undefined || value === null || value === '') continue
    normalized[key] = String(value)
  }
  return `${url}?${JSON.stringify(normalized)}`
}

function coalescedGet(url, params, config = {}) {
  const key = cacheKey(url, params)
  const existing = getInFlight.get(key)
  if (existing) return existing
  const request = api.get(url, { params, ...config }).finally(() => {
    if (getInFlight.get(key) === request) {
      getInFlight.delete(key)
    }
  })
  getInFlight.set(key, request)
  return request
}

export const roomService = {
  list: (params, config = {}) => coalescedGet('/rooms/', params, config),
  get: (id, config = {}) => api.get(`/rooms/${id}/`, config),
  create: (data) => api.post('/rooms/', data),
  update: (id, data) => api.put(`/rooms/${id}/`, data),
  delete: (id) => api.delete(`/rooms/${id}/`),
}

export const bedService = {
  list: (params, config = {}) => coalescedGet('/beds/', params, config),
  listAvailable: (params, config = {}) => coalescedGet('/beds/available/', params, config),
  summary: (config = {}) => coalescedGet('/beds/summary/', undefined, config),
  get: (id, config = {}) => api.get(`/beds/${id}/`, config),
  create: (data) => api.post('/beds/', data),
  update: (id, data) => api.put(`/beds/${id}/`, data),
  delete: (id) => api.delete(`/beds/${id}/`),
  assign: (id, data) => api.post(`/beds/${id}/assign/`, data),
  release: (id) => api.post(`/beds/${id}/release/`),
  updateStatus: (id, data) => api.patch(`/beds/${id}/status/`, data),
}
