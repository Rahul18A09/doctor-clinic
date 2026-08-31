import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { notificationService } from '@/api/notifications'
import { useAuth } from '@/hooks/useAuth'

const POLL_INTERVAL_MS = 60_000
const RECENT_PAGE_SIZE = 10

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [recent, setRecent] = useState([])
  const [recentLoading, setRecentLoading] = useState(false)
  const mountedRef = useRef(true)
  const intervalRef = useRef(null)
  const unreadInFlightRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const refreshUnreadCount = useCallback(async () => {
    if (!isAuthenticated) {
      if (mountedRef.current) setUnreadCount(0)
      return
    }
    if (unreadInFlightRef.current) return
    unreadInFlightRef.current = true
    try {
      const { data: res } = await notificationService.unreadCount()
      if (mountedRef.current) {
        setUnreadCount(res?.data?.unread_count ?? 0)
      }
    } catch {
      if (!mountedRef.current) return
    } finally {
      unreadInFlightRef.current = false
    }
  }, [isAuthenticated])

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
      if (mountedRef.current) {
        setRecent(res?.data?.results ?? [])
      }
    } catch {
      if (!mountedRef.current) return
    } finally {
      if (mountedRef.current) setRecentLoading(false)
    }
  }, [isAuthenticated])

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
      return undefined
    }

    let cancelled = false
    refreshUnreadCount()

    intervalRef.current = window.setInterval(() => {
      if (cancelled) return
      refreshUnreadCount()
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      stopPolling()
    }
  }, [isAuthenticated, refreshUnreadCount, stopPolling])

  const markRead = useCallback(
    async (id) => {
      await notificationService.markRead(id)
      await Promise.all([refreshUnreadCount(), fetchRecent()])
    },
    [refreshUnreadCount, fetchRecent],
  )

  const markAllRead = useCallback(async () => {
    await notificationService.markAllRead()
    await Promise.all([refreshUnreadCount(), fetchRecent()])
  }, [refreshUnreadCount, fetchRecent])

  const deleteNotification = useCallback(
    async (id) => {
      await notificationService.delete(id)
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
