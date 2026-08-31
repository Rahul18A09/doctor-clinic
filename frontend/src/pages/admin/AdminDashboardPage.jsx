import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { doctorConsultationService } from '@/api/doctor'
import { StatCard } from '@/components/dashboard/StatCard'
import { RefreshButton } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { CONSULTATION_TABS, ROUTES } from '@/utils/constants'

function MdOutlineKeyboardArrowRight({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
    </svg>
  )
}

const statConfig = [
  {
    key: 'waiting',
    title: 'Waiting Patients',
    tab: CONSULTATION_TABS.WAITING,
    trend: 'In queue now',
    color: 'amber',
    variant: 'waiting',
  },
  {
    key: 'in_consultation',
    title: 'In Consultation',
    tab: CONSULTATION_TABS.IN_CONSULTATION,
    trend: 'Currently active',
    color: 'blue',
    variant: 'consultation',
  },
  {
    key: 'completed',
    title: 'Completed Patients',
    tab: CONSULTATION_TABS.COMPLETED,
    trend: 'All time',
    color: 'green',
    variant: 'completed',
  },
  {
    key: 'today',
    title: "Today's Patients",
    tab: CONSULTATION_TABS.WAITING,
    trend: 'Registered today',
    color: 'primary',
    variant: 'today',
  },
]

export function AdminDashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    waiting: 0,
    in_consultation: 0,
    completed: 0,
    today: 0,
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchStats = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const { data: res } = await doctorConsultationService.getStats()
      setStats(res.data)
    } catch {
      // Keep existing counts on silent refresh failure.
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
            Welcome back, {user?.full_name?.split(' ')[0]}
          </h2>
          <p className="mt-1 text-sm text-muted">
            Here&apos;s an overview of consultation activity.
          </p>
        </div>
        <RefreshButton onClick={handleRefresh} loading={refreshing} className="shrink-0" />
      </div>

      <div className="dashboard-stat-grid dashboard-stat-grid--admin">
        {statConfig.map((stat) => (
          <Link
            key={stat.key}
            to={
              stat.key === 'waiting'
                ? `${ROUTES.ADMIN_CONSULTATIONS}?tab=${stat.tab}&today=false`
                : `${ROUTES.ADMIN_CONSULTATIONS}?tab=${stat.tab}`
            }
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

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <h3 className="text-lg font-semibold text-foreground">Consultation Queue</h3>
        <p className="mt-2 text-sm text-muted">
          Open the consultations page to manage waiting patients, continue in-progress
          consultations, or review completed treatments.
        </p>
        <Link
          to={ROUTES.ADMIN_CONSULTATIONS}
          className="mt-4 inline-flex w-full items-center justify-center gap-0.5 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary-500/25 transition-colors hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 sm:w-auto"
        >
          Go to Consultations
          <MdOutlineKeyboardArrowRight className="h-5 w-5" />
        </Link>
      </div>
    </div>
  )
}
