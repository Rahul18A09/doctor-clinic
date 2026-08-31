import api from './axios'

export const settingsService = {
  get() {
    return api.get('/settings/')
  },
  updateClinic(data) {
    return api.patch('/settings/clinic/', data)
  },
  updateQueue(data) {
    return api.patch('/settings/queue/', data)
  },
  updateNotifications(data) {
    return api.patch('/settings/notifications/', data)
  },
  updatePreferences(data) {
    return api.patch('/settings/preferences/', data)
  },
}
