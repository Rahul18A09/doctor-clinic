import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { patientService } from '@/api/patients'
import { StatCard } from '@/components/dashboard/StatCard'
import { PatientQueueQRCard } from '@/components/queue/PatientQueueQRCard'
import { ReceptionDeskCard } from '@/components/queue/ReceptionDeskCard'
import { RefreshButton } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/utils/constants'

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
    title: 'Waiting',
    filter: 'waiting',
    trend: 'In waiting room',
    color: 'amber',
    variant: 'waiting',
  },
  {
    key: 'completed_today',
    title: 'Visit Completed',
    filter: 'completed',
    trend: 'Visits completed today',
    color: 'green',
    variant: 'completed',
  },
]

export function ReceptionistDashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    today: 0,
    waiting: 0,
    completed_today: 0,
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchStats = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const { data: res } = await patientService.getStats()
      setStats(res.data)
    } catch {
      // Keep existing counts on refresh failure.
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const handleRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await fetchStats({ silent: true })
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
