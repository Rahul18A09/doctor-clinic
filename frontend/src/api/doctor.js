import api from './axios'

export const doctorConsultationService = {
  list: (params) => api.get('/doctor/patients/', { params }),
  listCompleted: (params) => api.get('/doctor/patients/completed/', { params }),
  getStats: () => api.get('/doctor/stats/'),
  get: (id) => api.get(`/doctor/patients/${id}/`),
  start: (id) => api.post(`/doctor/patients/${id}/start/`),
  saveConsultation: (id, data) => api.put(`/doctor/patients/${id}/consultation/`, data),
  complete: (id) => api.post(`/doctor/patients/${id}/complete/`),
  cancel: (id) => api.post(`/doctor/patients/${id}/cancel/`),
}
