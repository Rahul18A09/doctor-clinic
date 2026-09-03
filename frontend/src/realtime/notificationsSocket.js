import { io } from 'socket.io-client'
import { getToken } from '@/api/axios'
import { API_BASE_URL, TOKEN_KEY } from '@/utils/constants'

export const NOTIFICATION_CREATED_EVENT = 'notification:created'
export const NOTIFICATION_REMOVED_EVENT = 'notification:removed'

let socket = null

export function resolveSocketUrl() {
  if (typeof window === 'undefined') {
    return ''
  }
  if (!API_BASE_URL || API_BASE_URL.startsWith('/')) {
    return window.location.origin
  }
  try {
    return new URL(API_BASE_URL).origin
  } catch {
    return window.location.origin
  }
}

export function connectNotificationsSocket() {
  if (socket) {
    if (!socket.connected) {
      socket.connect()
    }
    return socket
  }

  socket = io(resolveSocketUrl(), {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
    auth: (cb) => {
      cb({ token: getToken(TOKEN_KEY) || '' })
    },
  })

  return socket
}

export function disconnectNotificationsSocket() {
  if (!socket) return
  socket.removeAllListeners()
  socket.disconnect()
  socket = null
}
