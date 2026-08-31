import api from './axios'

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
    return api.get('/auth/me/')
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
