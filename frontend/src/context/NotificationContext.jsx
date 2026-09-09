import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { notificationService } from '@/api/notifications'
import { useAuth } from '@/hooks/useAuth'
import {
  NOTIFICATION_CREATED_EVENT,
  NOTIFICATION_REMOVED_EVENT,
  connectNotificationsSocket,
  disconnectNotificationsSocket,
} from '@/realtime/notificationsSocket'

const POLL_INTERVAL_MS = 60_000
const RECENT_PAGE_SIZE = 10

const NotificationContext = createContext(null)

function sortRecent(items) {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left?.created_at ?? '') || 0
    const rightTime = Date.parse(right?.created_at ?? '') || 0
    return rightTime - leftTime
  })
}

function mergeRecent(apiResults, socketBuffer) {
  const byId = new Map()
  for (const item of apiResults) {
    if (item?.id) {
      byId.set(item.id, item)
      if (socketBuffer.has(item.id)) {
        socketBuffer.delete(item.id)
      }
    }
  }
  for (const [id, item] of socketBuffer) {
    if (id && item && !byId.has(id)) {
      byId.set(id, item)
    }
  }
  return sortRecent([...byId.values()]).slice(0, RECENT_PAGE_SIZE)
}

export function NotificationProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [recent, setRecent] = useState([])
  const [recentLoading, setRecentLoading] = useState(false)
  const [inboxRevision, setInboxRevision] = useState(0)
  const mountedRef = useRef(true)
  const intervalRef = useRef(null)
  const unreadGenRef = useRef(0)
  const unreadInFlightRef = useRef(null)
  const recentInFlightRef = useRef(null)
  const recentWantedRef = useRef(false)
  const seenIdsRef = useRef(new Set())
  const socketBufferRef = useRef(new Map())
  const socketConnectedRef = useRef(false)
  const hasSocketConnectedOnceRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const refreshUnreadCount = useCallback(async () => {
    if (!isAuthenticated) {
      unreadGenRef.current += 1
      unreadInFlightRef.current = null
      if (mountedRef.current) setUnreadCount(0)
      return 0
    }
    if (unreadInFlightRef.current) {
      return unreadInFlightRef.current
    }

    const gen = ++unreadGenRef.current
    const request = (async () => {
      try {
        const { data: res } = await notificationService.unreadCount()
        const count = res?.data?.unread_count ?? 0
        if (mountedRef.current && gen === unreadGenRef.current) {
          setUnreadCount(count)
        }
        return count
      } catch {
        return null
      } finally {
        if (unreadInFlightRef.current === request) {
          unreadInFlightRef.current = null
        }
      }
    })()

    unreadInFlightRef.current = request
    return request
  }, [isAuthenticated])

  const fetchRecent = useCallback(async () => {
    if (!isAuthenticated) {
      if (mountedRef.current) setRecent([])
      return []
    }
    recentWantedRef.current = true
    if (recentInFlightRef.current) {
      return recentInFlightRef.current
    }

    setRecentLoading(true)
    const request = (async () => {
      try {
        const { data: res } = await notificationService.list({
          page: 1,
          page_size: RECENT_PAGE_SIZE,
        })
        const results = res?.data?.results ?? []
        for (const item of results) {
          if (item?.id) seenIdsRef.current.add(item.id)
        }
        if (mountedRef.current) {
          setRecent(mergeRecent(results, socketBufferRef.current))
        }
        return results
      } catch {
        return []
      } finally {
        if (mountedRef.current) setRecentLoading(false)
        if (recentInFlightRef.current === request) {
          recentInFlightRef.current = null
        }
      }
    })()

    recentInFlightRef.current = request
    return request
  }, [isAuthenticated])

  const bumpInboxRevision = useCallback(() => {
    setInboxRevision((value) => value + 1)
  }, [])

  const applyCreatedNotification = useCallback((notification) => {
    if (!notification?.id || seenIdsRef.current.has(notification.id)) {
      return
    }
    seenIdsRef.current.add(notification.id)
    socketBufferRef.current.set(notification.id, notification)
    if (recentWantedRef.current) {
      setRecent((prev) => mergeRecent(prev, socketBufferRef.current))
    }
    if (!notification.is_read) {
      setUnreadCount((count) => count + 1)
    }
    bumpInboxRevision()
  }, [bumpInboxRevision])

  const applyRemovedNotification = useCallback((id) => {
    if (!id) return
    seenIdsRef.current.delete(id)
    const buffered = socketBufferRef.current.get(id)
    socketBufferRef.current.delete(id)
    setRecent((prev) => {
      const existing = prev.find((item) => item.id === id)
      const wasUnread = Boolean(
        (existing && !existing.is_read) || (buffered && !buffered.is_read),
      )
      if (wasUnread) {
        queueMicrotask(() => {
          setUnreadCount((count) => Math.max(0, count - 1))
        })
      }
      return prev.filter((item) => item.id !== id)
    })
    bumpInboxRevision()
  }, [bumpInboxRevision])

  const refresh = useCallback(async () => {
    await refreshUnreadCount()
  }, [refreshUnreadCount])

  const stopPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  useEffect(() => {
    stopPolling()

    if (!isAuthenticated) {
      setUnreadCount(0)
      setRecent([])
      recentWantedRef.current = false
      seenIdsRef.current = new Set()
      socketBufferRef.current = new Map()
      disconnectNotificationsSocket()
      socketConnectedRef.current = false
      hasSocketConnectedOnceRef.current = false
      return undefined
    }

    let cancelled = false
    void refreshUnreadCount()

    intervalRef.current = window.setInterval(() => {
      if (cancelled) return
      if (!socketConnectedRef.current) {
        void refreshUnreadCount()
      }
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      stopPolling()
    }
  }, [isAuthenticated, refreshUnreadCount, stopPolling])

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined
    }

    const socket = connectNotificationsSocket()

    const onCreated = (payload) => {
      applyCreatedNotification(payload?.notification)
    }
    const onRemoved = (payload) => {
      applyRemovedNotification(payload?.id)
    }
    const onConnect = () => {
      const shouldResync = hasSocketConnectedOnceRef.current
      socketConnectedRef.current = true
      hasSocketConnectedOnceRef.current = true
      // Initial unread comes from the auth effect; only re-sync after a reconnect.
      if (shouldResync) {
        void refreshUnreadCount()
      }
    }
    const onDisconnect = () => {
      socketConnectedRef.current = false
    }

    socket.on(NOTIFICATION_CREATED_EVENT, onCreated)
    socket.on(NOTIFICATION_REMOVED_EVENT, onRemoved)
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)

    if (socket.connected) {
      socketConnectedRef.current = true
      hasSocketConnectedOnceRef.current = true
    }

    return () => {
      socket.off(NOTIFICATION_CREATED_EVENT, onCreated)
      socket.off(NOTIFICATION_REMOVED_EVENT, onRemoved)
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      // Keep the shared socket alive across remounts; disconnect only on logout.
    }
  }, [
    isAuthenticated,
    applyCreatedNotification,
    applyRemovedNotification,
    refreshUnreadCount,
  ])

  const markRead = useCallback(
    async (id) => {
      await notificationService.markRead(id)
      socketBufferRef.current.delete(id)
      setRecent((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, is_read: true, read_at: item.read_at || new Date().toISOString() }
            : item,
        ),
      )
      setUnreadCount((count) => Math.max(0, count - 1))
      void refreshUnreadCount()
    },
    [refreshUnreadCount],
  )

  const markAllRead = useCallback(async () => {
    await notificationService.markAllRead()
    socketBufferRef.current.clear()
    setRecent((prev) => prev.map((item) => ({ ...item, is_read: true })))
    setUnreadCount(0)
    void refreshUnreadCount()
  }, [refreshUnreadCount])

  const deleteNotification = useCallback(
    async (id) => {
      await notificationService.delete(id)
      seenIdsRef.current.delete(id)
      socketBufferRef.current.delete(id)
      let wasUnread = false
      setRecent((prev) => {
        const existing = prev.find((item) => item.id === id)
        wasUnread = Boolean(existing && !existing.is_read)
        return prev.filter((item) => item.id !== id)
      })
      if (wasUnread) {
        setUnreadCount((count) => Math.max(0, count - 1))
      }
      void refreshUnreadCount()
    },
    [refreshUnreadCount],
  )

  const value = useMemo(
    () => ({
      unreadCount,
      recent,
      loading: recentLoading,
      inboxRevision,
      refresh,
      refreshUnreadCount,
      fetchRecent,
      markRead,
      markAllRead,
      deleteNotification,
    }),
    [
      unreadCount,
      recent,
      recentLoading,
      inboxRevision,
      refresh,
      refreshUnreadCount,
      fetchRecent,
      markRead,
      markAllRead,
      deleteNotification,
    ],
  )

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotificationContext() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationProvider')
  }
  return context
}
