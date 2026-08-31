import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/hooks/useNotifications'
import { formatRelativeTime } from '@/utils/notifications'
import { ROLES, ROUTES } from '@/utils/constants'
import { NotificationTypeIcon, notificationSubjectText } from './NotificationTypeIcon'

function unreadLabel(count) {
  if (count > 99) return '99+'
  return String(count)
}

export function NotificationBell() {
  const { user } = useAuth()
  const { unreadCount, recent, loading, markRead, markAllRead, deleteNotification, fetchRecent } =
    useNotifications()
  const [open, setOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const panelRef = useRef(null)

  const viewAllPath =
    user?.role === ROLES.ADMIN ? ROUTES.ADMIN_NOTIFICATIONS : ROUTES.RECEPTION_NOTIFICATIONS

  useEffect(() => {
    if (!open) return undefined
    fetchRecent()
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, fetchRecent])

  const handleMarkRead = async (event, id) => {
    event.preventDefault()
    event.stopPropagation()
    setActionLoading(id)
    try {
      await markRead(id)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (event, id) => {
    event.preventDefault()
    event.stopPropagation()
    setActionLoading(id)
    try {
      await deleteNotification(id)
    } finally {
      setActionLoading(null)
    }
  }

  const handleMarkAll = async () => {
    setActionLoading('all')
    try {
      await markAllRead()
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        className="relative rounded-xl p-2 text-muted transition-colors hover:bg-surface hover:text-foreground"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {unreadLabel(unreadCount)}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30 bg-slate-900/20 lg:bg-transparent"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-x-3 top-[4.35rem] z-40 flex max-h-[min(28rem,calc(100dvh-5.25rem))] w-auto flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg animate-in fade-in slide-in-from-top-2 duration-200 lg:absolute lg:inset-x-auto lg:right-0 lg:top-auto lg:mt-2 lg:w-[22rem] lg:max-h-[min(28rem,calc(100dvh-6rem))]">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-3 py-3 sm:px-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">Notifications</p>
                <p className="truncate text-xs text-muted">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
                </p>
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAll}
                  disabled={actionLoading === 'all'}
                  className="shrink-0 whitespace-nowrap text-xs font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50"
                >
                  Mark all as read
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {loading && recent.length === 0 ? (
                <div className="flex justify-center py-10">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
                </div>
              ) : recent.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted">No notifications yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {recent.map((item) => {
                    const subject = notificationSubjectText(item)
                    return (
                      <li key={item.id} className={item.is_read ? 'bg-card' : 'bg-primary-50/70'}>
                        <div className="flex gap-3 px-3 py-3 sm:px-4">
                          <NotificationTypeIcon type={item.type} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="min-w-0 break-words text-sm font-medium text-foreground">{item.title}</p>
                              <span
                                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                                  item.is_read ? 'bg-border' : 'bg-primary-600'
                                }`}
                                aria-label={item.is_read ? 'Read' : 'Unread'}
                              />
                            </div>
                            {subject ? (
                              <p className="mt-0.5 truncate text-xs font-medium text-foreground/80">
                                {subject}
                              </p>
                            ) : null}
                            <p className="mt-0.5 text-[11px] text-muted">
                              {formatRelativeTime(item.created_at)}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                              {!item.is_read && (
                                <button
                                  type="button"
                                  onClick={(event) => handleMarkRead(event, item.id)}
                                  disabled={actionLoading === item.id}
                                  className="text-[11px] font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50"
                                >
                                  Mark as read
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(event) => handleDelete(event, item.id)}
                                disabled={actionLoading === item.id}
                                className="text-[11px] font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="shrink-0 border-t border-border bg-surface px-4 py-2.5">
              <Link
                to={viewAllPath}
                onClick={() => setOpen(false)}
                className="block text-center text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                View all
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
