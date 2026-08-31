import api from './axios'

export const receptionistService = {
  list: (params) => api.get('/receptionists/', { params }),
  get: (id) => api.get(`/receptionists/${id}/`),
  create: (data) => api.post('/receptionists/', data),
  update: (id, data) => api.put(`/receptionists/${id}/`, data),
  delete: (id) => api.delete(`/receptionists/${id}/`),
  activate: (id) => api.post(`/receptionists/${id}/activate/`),
  deactivate: (id) => api.post(`/receptionists/${id}/deactivate/`),
}
