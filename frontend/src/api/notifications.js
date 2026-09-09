import api from './axios'

const listInFlight = new Map()

function listCacheKey(params = {}) {
  const normalized = {}
  for (const key of Object.keys(params).sort()) {
    const value = params[key]
    if (value === undefined || value === null || value === '') continue
    normalized[key] = String(value)
  }
  return JSON.stringify(normalized)
}

export const notificationService = {
  list: (params, config = {}) => {
    const key = listCacheKey(params)
    const existing = listInFlight.get(key)
    if (existing) {
      return existing
    }

    const request = api.get('/notifications/', { params, ...config }).finally(() => {
      if (listInFlight.get(key) === request) {
        listInFlight.delete(key)
      }
    })
    listInFlight.set(key, request)
    return request
  },
  unreadCount: () => api.get('/notifications/unread-count/'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
  delete: (id) => api.delete(`/notifications/${id}`),
}
