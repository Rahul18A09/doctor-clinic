import api from './axios'
import type { ApiSuccessResponse, PublicQueueStatus } from '@/types/queue'

export const queueService = {
  getStatus: () =>
    api.get<ApiSuccessResponse<PublicQueueStatus>>('/queue/', {
      params: { _: Date.now() },
      validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
    }),
}
