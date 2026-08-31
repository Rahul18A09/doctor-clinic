import api from './axios'

export const patientService = {
  list: (params) => api.get('/patients/', { params }),
  getStats: () => api.get('/patients/stats/'),
  lookup: (query) => {
    if (typeof query === 'string') {
      return api.get('/patients/lookup/', { params: { mobile: query } })
    }
    return api.get('/patients/lookup/', { params: query })
  },
  get: (id) => api.get(`/patients/${id}/`),
  create: (data) => api.post('/patients/', data),
  update: (id, data) => api.put(`/patients/${id}/`, data),
  delete: (id) => api.delete(`/patients/${id}/`),
}
