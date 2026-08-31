import api from './axios'

export const reportsService = {
  get(params) {
    return api.get('/reports/', { params })
  },
  exportCsv(params) {
    return api.get('/reports/export/', { params, responseType: 'blob' })
  },
}
