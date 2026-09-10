import { io } from 'socket.io-client'
import { getToken } from '@/api/axios'
import { API_BASE_URL, TOKEN_KEY } from '@/utils/constants'

export const NOTIFICATION_CREATED_EVENT = 'notification:created'
export const NOTIFICATION_REMOVED_EVENT = 'notification:removed'

let socket = null
let lifecycleBound = false

function readAuthToken(explicitToken) {
  const fromArg = typeof explicitToken === 'string' ? explicitToken.trim() : ''
  if (fromArg) return fromArg
  return (getToken(TOKEN_KEY) || '').trim()
}

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

function bindLifecycleLogs(instance) {
  if (lifecycleBound) return
  lifecycleBound = true

  instance.on('connect', () => {
    console.log(
      `[Socket] connected id=${instance.id} transport=${instance.io?.engine?.transport?.name || 'unknown'}`,
    )
  })

  instance.on('disconnect', (reason) => {
    console.log(`[Socket] disconnected reason=${reason}`)
  })

  instance.on('connect_error', (error) => {
    console.warn(`[Socket] connect_error: ${error?.message || error}`)
  })
}

export function getNotificationsSocket() {
  return socket
}

export function connectNotificationsSocket(explicitToken) {
  const token = readAuthToken(explicitToken)
  if (!token) {
    console.warn('[Socket] skip connect: no auth token')
    return null
  }

  const url = resolveSocketUrl()

  if (!socket) {
    console.log(`[Socket] connecting → ${url}`)
    socket = io(url, {
      path: '/socket.io',
      // Polling first is more reliable through the Vite HTTPS proxy; upgrades to websocket.
      transports: ['polling', 'websocket'],
      withCredentials: true,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
      // Always read the latest token from storage on (re)connect.
      auth: (cb) => {
        cb({ token: readAuthToken() })
      },
    })
    bindLifecycleLogs(socket)
  }

  socket.auth = { token }
  if (!socket.connected) {
    socket.connect()
  }

  return socket
}

export function disconnectNotificationsSocket() {
  if (!socket) return
  const current = socket
  socket = null
  lifecycleBound = false
  console.log('[Socket] disconnect (logout)')
  current.removeAllListeners()
  current.disconnect()
}
