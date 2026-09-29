import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { patientService } from '@/api/patients'
import { StatCard } from '@/components/dashboard/StatCard'
import { PatientQueueQRCard } from '@/components/queue/PatientQueueQRCard'
import { ReceptionDeskCard } from '@/components/queue/ReceptionDeskCard'
import { RefreshButton } from '@/components/ui'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/hooks/useNotifications'
import { ROUTES } from '@/utils/constants'
import { getApiErrorMessage } from '@/utils/errors'
import {
  SESSION_CACHE_KEYS,
  getSessionCache,
  invalidateSessionCache,
  setSessionCache,
} from '@/utils/sessionCache'

const EMPTY_STATS = {
  today: 0,
  waiting: 0,
  completed_today: 0,
}

const statConfig = [
  {
    key: 'today',
    title: "Today's Patients",
    filter: 'today',
    trend: 'Registered today',
    color: 'primary',
    variant: 'today',
  },
  {
    key: 'waiting',
    title: 'Waiting Patients',
    filter: 'waiting',
    trend: 'In waiting room',
    color: 'amber',
    variant: 'waiting',
  },
  {
    key: 'completed_today',
    title: 'Consultations Completed',
    filter: 'completed',
    trend: 'Completed today',
    color: 'green',
    variant: 'completed',
  },
]

export function ReceptionistDashboardPage() {
  const { user } = useAuth()
  const { showError } = useToast()
  const { activityRevision } = useNotifications()
  const cachedStats = getSessionCache(SESSION_CACHE_KEYS.PATIENT_STATS)
  const [stats, setStats] = useState(cachedStats ?? EMPTY_STATS)
  const [loading, setLoading] = useState(!cachedStats)
  const [refreshing, setRefreshing] = useState(false)
  const seenActivityRevisionRef = useRef(activityRevision)
  const statsGenRef = useRef(0)

  const fetchStats = useCallback(async ({ silent = false } = {}) => {
    const gen = ++statsGenRef.current
    if (!silent && !getSessionCache(SESSION_CACHE_KEYS.PATIENT_STATS)) setLoading(true)
    try {
      const { data: res } = await patientService.getStats()
      if (gen !== statsGenRef.current) return false
      const next = res.data ?? EMPTY_STATS
      setStats(next)
      setSessionCache(SESSION_CACHE_KEYS.PATIENT_STATS, next)
      return true
    } catch (err) {
      if (gen !== statsGenRef.current) return false
      if (!silent) {
        showError(getApiErrorMessage(err, 'Failed to load dashboard stats.'))
      }
      return false
    } finally {
      if (gen === statsGenRef.current && !silent) setLoading(false)
    }
  }, [showError])

  useEffect(() => {
    void fetchStats({ silent: Boolean(cachedStats) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (seenActivityRevisionRef.current === activityRevision) return
    seenActivityRevisionRef.current = activityRevision
    invalidateSessionCache(SESSION_CACHE_KEYS.PATIENT_STATS)
    void fetchStats({ silent: true })
  }, [activityRevision, fetchStats])

  const handleRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    invalidateSessionCache(SESSION_CACHE_KEYS.PATIENT_STATS)
    try {
      const ok = await fetchStats({ silent: true })
      if (!ok) {
        showError('Failed to refresh dashboard.')
      }
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-foreground sm:text-2xl">
            Hello, {user?.full_name?.split(' ')[0]}
          </h2>
          <p className="mt-1 text-sm text-muted">
            Manage patient registrations and queue from here.
          </p>
        </div>
        <RefreshButton onClick={handleRefresh} loading={refreshing} className="shrink-0" />
      </div>

      <div className="dashboard-stat-grid dashboard-stat-grid--reception">
        {statConfig.map((stat) => (
          <Link
            key={stat.key}
            to={`${ROUTES.RECEPTION_PATIENTS}?filter=${stat.filter}`}
            className="block h-full min-w-0 max-w-full transition-transform hover:scale-[1.01]"
          >
            <StatCard
              title={stat.title}
              value={loading ? '—' : String(stats[stat.key] ?? 0)}
              trend={stat.trend}
              color={stat.color}
              variant={stat.variant}
              watermark
            />
          </Link>
        ))}
      </div>

      <div className="grid gap-4 2xl:grid-cols-2">
        <ReceptionDeskCard />
        <PatientQueueQRCard />
      </div>
    </div>
  )
}
