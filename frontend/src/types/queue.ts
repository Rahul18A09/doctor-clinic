/** Public live queue status returned by GET /api/v1/queue/ */
export interface PublicQueueStatus {
  todays_token: string
  current_token: string
  current_patient_name: string
}

export interface ApiSuccessResponse<T> {
  success: true
  message: string
  data: T
}

export interface ApiErrorResponse {
  success: false
  message: string
  errors?: Record<string, string[] | string>
}

export type QueueFetchState = 'idle' | 'loading' | 'success' | 'error' | 'empty'
