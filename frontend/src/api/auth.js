import api from './axios'

let currentUserInFlight = null

export const authService = {
  login(credentials) {
    console.log('[authService.login] executing with credentials:', credentials)
    return api.post('/auth/login/', credentials)
  },

  logout() {
    console.log('[authService.logout] executing')
    return api.post('/auth/logout/')
  },

  refreshToken(refresh) {
    return api.post('/auth/token/refresh/', { refresh })
  },

  getCurrentUser() {
    if (currentUserInFlight) return currentUserInFlight
    currentUserInFlight = api.get('/auth/me/').finally(() => {
      currentUserInFlight = null
    })
    return currentUserInFlight
  },

  updateProfile(data) {
    return api.patch('/auth/me/', data)
  },

  changePassword(data) {
    return api.post('/auth/change-password/', data)
  },
}

// Backward-compatible alias
export const authApi = authService
