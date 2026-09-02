import api from './axios'
import { getApiErrorMessage } from '@/utils/errors'

export function getBedsErrorMessage(error, fallback = 'Something went wrong.') {
  const status = error.response?.status
  if (status === 500) return 'Server error. Please try again.'
  return getApiErrorMessage(error, fallback)
}

export const roomService = {
  list: (params, config = {}) => api.get('/rooms/', { params, ...config }),
  get: (id, config = {}) => api.get(`/rooms/${id}/`, config),
  create: (data) => api.post('/rooms/', data),
  update: (id, data) => api.put(`/rooms/${id}/`, data),
  delete: (id) => api.delete(`/rooms/${id}/`),
}

export const bedService = {
  list: (params, config = {}) => api.get('/beds/', { params, ...config }),
  listAvailable: (params, config = {}) => api.get('/beds/available/', { params, ...config }),
  summary: (config = {}) => api.get('/beds/summary/', config),
  get: (id, config = {}) => api.get(`/beds/${id}/`, config),
  create: (data) => api.post('/beds/', data),
  update: (id, data) => api.put(`/beds/${id}/`, data),
  delete: (id) => api.delete(`/beds/${id}/`),
  assign: (id, data) => api.post(`/beds/${id}/assign/`, data),
  release: (id) => api.post(`/beds/${id}/release/`),
  updateStatus: (id, data) => api.patch(`/beds/${id}/status/`, data),
}
