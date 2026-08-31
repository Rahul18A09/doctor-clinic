import { useCallback, useEffect, useRef, useState } from 'react'
import { notificationService } from '@/api/notifications'
import { Badge, Button, ConfirmDialog, ListStatus, RefreshButton, Select } from '@/components/ui'
import { DeleteIconButton } from '@/components/patients/ViewIconButton'
import {
  NotificationTypeIcon,
  getNotificationTypeVisual,
} from '@/components/notifications/NotificationTypeIcon'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/hooks/useNotifications'
import {
  formatNotificationTime,
  notificationFilterOptionsForRole,
  notificationTypeQueryValue,
  NOTIFICATION_TYPE_BADGE,
  NOTIFICATION_TYPE_LABELS,
} from '@/utils/notifications'

const PAGE_SIZE = 10

export function NotificationsPage() {
  const { showError, showSuccess } = useToast()
  const { user } = useAuth()
  const { refresh, markRead, markAllRead, deleteNotification, unreadCount } = useNotifications()
  const skipUnreadListRefetch = useRef(true)
  const typeOptions = notificationFilterOptionsForRole(user?.role)

  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState('')
  const [readFilter, setReadFilter] = useState('')
  const [pagination, setPagination] = useState({
    total_pages: 1,
    total: 0,
    has_next: false,
    has_previous: false,
  })
  const [visibleUnread, setVisibleUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [actionLoading, setActionLoading] = useState(null)
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, title: '' })

  const fetchNotifications = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true)
      try {
        const params = { page, page_size: PAGE_SIZE }
        const typeQuery = notificationTypeQueryValue(typeFilter)
        if (typeQuery) params.type = typeQuery
        if (readFilter) params.is_read = readFilter
        const { data: res } = await notificationService.list(params)
        const total = res.data.pagination.total
        setItems(res.data.results)
        setPagination(res.data.pagination)
        setLoadError('')

        if (readFilter === 'true') {
          setVisibleUnread(0)
        } else if (readFilter === 'false') {
          setVisibleUnread(total)
        } else {
          const unreadParams = { page: 1, page_size: 1, is_read: 'false' }
          if (typeQuery) unreadParams.type = typeQuery
          const { data: unreadRes } = await notificationService.list(unreadParams)
          const unreadTotal = unreadRes.data.pagination.total
          setVisibleUnread(Math.min(unreadTotal, total))
        }
      } catch (err) {
        const message = err.response?.data?.message || err.message || 'Unable to load notifications.'
        if (!silent) {
          setLoadError(message)
          showError(message)
        }
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [page, typeFilter, readFilter, showError],
  )

  const fetchNotificationsRef = useRef(fetchNotifications)
  fetchNotificationsRef.current = fetchNotifications

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  useEffect(() => {
    if (skipUnreadListRefetch.current) {
      skipUnreadListRefetch.current = false
      return
    }
    fetchNotificationsRef.current({ silent: true })
  }, [unreadCount])

  const handleRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await Promise.all([fetchNotifications({ silent: true }), refresh()])
    } finally {
      setRefreshing(false)
    }
  }

  const handleMarkRead = async (id) => {
    setActionLoading(id)
    try {
      await markRead(id)
    } catch (err) {
      showError(err.response?.data?.message || err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleMarkAll = async () => {
    setActionLoading('all')
    try {
      await markAllRead()
      showSuccess('All notifications marked as read.')
    } catch (err) {
      showError(err.response?.data?.message || err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteDialog.id) return
    setActionLoading(deleteDialog.id)
    try {
      await deleteNotification(deleteDialog.id)
      setDeleteDialog({ open: false, id: null, title: '' })
      await fetchNotifications({ silent: true })
      showSuccess('Notification deleted.')
    } catch (err) {
      showError(err.response?.data?.message || err.message)
    } finally {
      setActionLoading(null)
    }
  }

  const rowNumber = (index) => (page - 1) * PAGE_SIZE + index + 1

  return (
    <div className="animate-in">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border px-4 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Notifications</h2>
            <p className="mt-1 text-sm text-muted">
              {pagination.total} total notifications
              {visibleUnread > 0 ? (
                <span className="ml-2 inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                  {visibleUnread} unread
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <RefreshButton onClick={handleRefresh} loading={refreshing} />
            <Button
              variant="secondary"
              onClick={handleMarkAll}
              disabled={unreadCount === 0 || actionLoading === 'all'}
              className="w-full sm:w-auto"
            >
              Mark all as read
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:px-6">
          <Select
            options={typeOptions}
            placeholder="All types"
            value={typeFilter}
            onChange={(e) => {
              setPage(1)
              setTypeFilter(e.target.value)
            }}
            className="w-full min-w-0 sm:w-52"
          />
          <Select
            options={[
              { value: 'false', label: 'Unread' },
              { value: 'true', label: 'Read' },
            ]}
            placeholder="All statuses"
            value={readFilter}
            onChange={(e) => {
              setPage(1)
              setReadFilter(e.target.value)
            }}
            className="w-full min-w-0 sm:w-52"
          />
        </div>

        {items.length === 0 ? (
          <ListStatus
            loading={loading}
            error={loadError}
            empty
            emptyLabel="No notifications found."
            onRetry={() => fetchNotifications()}
          />
        ) : (
          <>
            <div className="space-y-3 px-4 py-4 lg:hidden sm:px-6">
              {items.map((item, index) => {
                const typeVisual = getNotificationTypeVisual(item.type, item.title)
                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border border-border p-4 ${
                      item.is_read ? 'bg-card' : 'bg-primary-50/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <NotificationTypeIcon type={item.type} title={item.title} />
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{typeVisual.label}</p>
                          <p className="mt-0.5 text-xs text-muted">#{rowNumber(index)}</p>
                        </div>
                      </div>
                      <Badge variant={NOTIFICATION_TYPE_BADGE[item.type] || 'default'}>
                        {NOTIFICATION_TYPE_LABELS[item.type] || item.type}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm leading-5 text-muted">{item.message}</p>
                    <dl className="mt-3 space-y-1.5 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted">Patient</dt>
                        <dd className="text-foreground">{item.patient_name || '—'}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted">Token</dt>
                        <dd className="font-mono text-foreground">{item.token_number || '—'}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted">Time</dt>
                        <dd className="text-right text-foreground">{formatNotificationTime(item.created_at)}</dd>
                      </div>
                    </dl>
                    <div className="mt-3 flex flex-wrap items-center justify-end gap-1 border-t border-border pt-3">
                      {!item.is_read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={actionLoading === item.id}
                          onClick={() => handleMarkRead(item.id)}
                        >
                          Mark as read
                        </Button>
                      )}
                      <DeleteIconButton
                        disabled={actionLoading === item.id}
                        onClick={() => setDeleteDialog({ open: true, id: item.id, title: item.title })}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="table-scroll hidden lg:block">
              <table className="w-full min-w-[72rem] text-left text-sm">
                <thead className="border-b border-border bg-surface">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-5">#</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-5">Type</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-5">Patient</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-5">Token No.</th>
                    <th className="px-4 py-3 font-medium text-muted sm:px-5">Message</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-5">Status</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-5">Date & Time</th>
                    <th className="whitespace-nowrap px-4 py-3 font-medium text-muted sm:px-5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item, index) => {
                    const typeVisual = getNotificationTypeVisual(item.type, item.title)
                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors hover:bg-surface/80 ${
                          item.is_read ? 'bg-card' : 'bg-primary-50/40'
                        }`}
                      >
                        <td className="whitespace-nowrap px-4 py-4 text-muted sm:px-5">{rowNumber(index)}</td>
                        <td className="px-4 py-4 sm:px-5">
                          <div className="flex min-w-[13rem] items-center gap-3">
                            <NotificationTypeIcon type={item.type} title={item.title} />
                            <span className="font-medium text-foreground">{typeVisual.label}</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 font-medium text-foreground sm:px-5">
                          {item.patient_name || '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 font-mono text-foreground sm:px-5">
                          {item.token_number || '—'}
                        </td>
                        <td className="max-w-sm px-4 py-4 text-muted sm:max-w-md sm:px-5">
                          <p className="whitespace-normal break-words leading-5">{item.message}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 sm:px-5">
                          <Badge variant={NOTIFICATION_TYPE_BADGE[item.type] || 'default'}>
                            {NOTIFICATION_TYPE_LABELS[item.type] || item.type}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-muted sm:px-5">
                          {formatNotificationTime(item.created_at)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 sm:px-5">
                          <div className="flex items-center gap-1">
                            {!item.is_read && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={actionLoading === item.id}
                                onClick={() => handleMarkRead(item.id)}
                              >
                                Mark as read
                              </Button>
                            )}
                            <DeleteIconButton
                              disabled={actionLoading === item.id}
                              onClick={() => setDeleteDialog({ open: true, id: item.id, title: item.title })}
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {pagination.total_pages > 1 && (
          <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3 sm:px-6">
            <p className="text-sm text-muted">
              Page {page} of {pagination.total_pages}
            </p>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={!pagination.has_previous || loading}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </Button>
              <Button
                variant={pagination.has_next ? 'primary' : 'secondary'}
                size="sm"
                disabled={!pagination.has_next || loading}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteDialog.open}
        title="Delete notification"
        message={`Are you sure you want to delete "${deleteDialog.title}"?`}
        confirmLabel="Delete"
        variant="danger"
        loading={Boolean(actionLoading)}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialog({ open: false, id: null, title: '' })}
      />
    </div>
  )
}
