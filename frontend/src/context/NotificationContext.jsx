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
  const mountedRef = useRef(true)
  const intervalRef = useRef(null)
  const unreadGenRef = useRef(0)
  const unreadRefreshTimerRef = useRef(null)
  const seenIdsRef = useRef(new Set())
  const socketBufferRef = useRef(new Map())
  const socketConnectedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (unreadRefreshTimerRef.current !== null) {
        window.clearTimeout(unreadRefreshTimerRef.current)
        unreadRefreshTimerRef.current = null
      }
    }
  }, [])

  const refreshUnreadCount = useCallback(async () => {
    if (!isAuthenticated) {
      unreadGenRef.current += 1
      if (mountedRef.current) setUnreadCount(0)
      return
    }
    const gen = ++unreadGenRef.current
    try {
      const { data: res } = await notificationService.unreadCount()
      if (mountedRef.current && gen === unreadGenRef.current) {
        setUnreadCount(res?.data?.unread_count ?? 0)
      }
    } catch {
      if (!mountedRef.current) return
    }
  }, [isAuthenticated])

  const scheduleUnreadRefresh = useCallback(() => {
    if (unreadRefreshTimerRef.current !== null) {
      window.clearTimeout(unreadRefreshTimerRef.current)
    }
    unreadRefreshTimerRef.current = window.setTimeout(() => {
      unreadRefreshTimerRef.current = null
      void refreshUnreadCount()
    }, 150)
  }, [refreshUnreadCount])

  const fetchRecent = useCallback(async () => {
    if (!isAuthenticated) {
      if (mountedRef.current) setRecent([])
      return
    }
    setRecentLoading(true)
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
    } catch {
      if (!mountedRef.current) return
    } finally {
      if (mountedRef.current) setRecentLoading(false)
    }
  }, [isAuthenticated])

  const applyCreatedNotification = useCallback((notification) => {
    if (!notification?.id || seenIdsRef.current.has(notification.id)) {
      return
    }
    seenIdsRef.current.add(notification.id)
    socketBufferRef.current.set(notification.id, notification)
    setRecent((prev) => mergeRecent(prev, socketBufferRef.current))
    if (!notification.is_read) {
      setUnreadCount((count) => count + 1)
    }
    scheduleUnreadRefresh()
  }, [scheduleUnreadRefresh])

  const applyRemovedNotification = useCallback((id) => {
    if (!id) return
    seenIdsRef.current.delete(id)
    socketBufferRef.current.delete(id)
    setRecent((prev) => prev.filter((item) => item.id !== id))
    void refreshUnreadCount()
  }, [refreshUnreadCount])

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
      seenIdsRef.current = new Set()
      socketBufferRef.current = new Map()
      if (unreadRefreshTimerRef.current !== null) {
        window.clearTimeout(unreadRefreshTimerRef.current)
        unreadRefreshTimerRef.current = null
      }
      return undefined
    }

    let cancelled = false
    refreshUnreadCount()

    intervalRef.current = window.setInterval(() => {
      if (cancelled) return
      if (!socketConnectedRef.current) {
        refreshUnreadCount()
      }
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      stopPolling()
    }
  }, [isAuthenticated, refreshUnreadCount, stopPolling])

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectNotificationsSocket()
      socketConnectedRef.current = false
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
      socketConnectedRef.current = true
      void refreshUnreadCount()
      void fetchRecent()
    }
    const onDisconnect = () => {
      socketConnectedRef.current = false
    }

    socket.on(NOTIFICATION_CREATED_EVENT, onCreated)
    socket.on(NOTIFICATION_REMOVED_EVENT, onRemoved)
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)

    if (socket.connected) {
      onConnect()
    }

    return () => {
      socket.off(NOTIFICATION_CREATED_EVENT, onCreated)
      socket.off(NOTIFICATION_REMOVED_EVENT, onRemoved)
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      disconnectNotificationsSocket()
      socketConnectedRef.current = false
    }
  }, [
    isAuthenticated,
    applyCreatedNotification,
    applyRemovedNotification,
    refreshUnreadCount,
    fetchRecent,
  ])

  const markRead = useCallback(
    async (id) => {
      await notificationService.markRead(id)
      socketBufferRef.current.delete(id)
      await Promise.all([refreshUnreadCount(), fetchRecent()])
    },
    [refreshUnreadCount, fetchRecent],
  )

  const markAllRead = useCallback(async () => {
    await notificationService.markAllRead()
    socketBufferRef.current.clear()
    await Promise.all([refreshUnreadCount(), fetchRecent()])
  }, [refreshUnreadCount, fetchRecent])

  const deleteNotification = useCallback(
    async (id) => {
      await notificationService.delete(id)
      seenIdsRef.current.delete(id)
      socketBufferRef.current.delete(id)
      await Promise.all([refreshUnreadCount(), fetchRecent()])
    },
    [refreshUnreadCount, fetchRecent],
  )

  const value = useMemo(
    () => ({
      unreadCount,
      recent,
      loading: recentLoading,
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
