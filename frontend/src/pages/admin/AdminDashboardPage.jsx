import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LuBedDouble, LuPercent, LuUser } from 'react-icons/lu'
import { bedService } from '@/api/beds'
import { doctorConsultationService } from '@/api/doctor'
import { BedStatCard } from '@/components/beds/BedStatCard'
import { StatCard } from '@/components/dashboard/StatCard'
import { RefreshButton } from '@/components/ui'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/hooks/useNotifications'
import { CONSULTATION_TABS, ROUTES } from '@/utils/constants'
import { getApiErrorMessage } from '@/utils/errors'

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

const EMPTY_BED_OVERVIEW = {
  total: 0,
  occupied: 0,
  available: 0,
  currentInpatients: 0,
  occupancyPercent: 0,
}

const ICON_CLASS = 'h-5 w-5 sm:h-6 sm:w-6'

const bedOverviewCards = [
  {
    key: 'total',
    title: 'Total Beds',
    hint: 'All configured beds',
    tone: 'purple',
    icon: <LuBedDouble className={ICON_CLASS} aria-hidden="true" />,
  },
  {
    key: 'occupied',
    title: 'Occupied Beds',
    hint: 'Beds currently occupied',
    tone: 'sky',
    icon: <LuUser className={ICON_CLASS} aria-hidden="true" />,
  },
  {
    key: 'available',
    title: 'Available Beds',
    hint: 'Ready for assignment',
    tone: 'green',
    icon: <LuBedDouble className={ICON_CLASS} aria-hidden="true" />,
  },
  {
    key: 'currentInpatients',
    title: 'Current Inpatients',
    hint: 'Admission status Admitted',
    tone: 'blue',
    icon: <LuUser className={ICON_CLASS} aria-hidden="true" />,
  },
  {
    key: 'occupancyPercent',
    title: 'Occupancy %',
    hint: 'Occupied ÷ total beds',
    tone: 'orange',
    icon: <LuPercent className={ICON_CLASS} aria-hidden="true" />,
  },
]

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
    title: 'Consultations In Progress',
    tab: CONSULTATION_TABS.IN_CONSULTATION,
    trend: 'Currently active',
    color: 'blue',
    variant: 'consultation',
  },
  {
    key: 'completed_today',
    title: 'Consultations Completed',
    tab: CONSULTATION_TABS.COMPLETED,
    trend: 'Completed today',
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
  const navigate = useNavigate()
  const { showError } = useToast()
  const { inboxRevision } = useNotifications()
  const [stats, setStats] = useState({
    waiting: 0,
    in_consultation: 0,
    completed: 0,
    completed_today: 0,
    today: 0,
  })
  const [bedOverview, setBedOverview] = useState(EMPTY_BED_OVERVIEW)
  const [loading, setLoading] = useState(true)
  const [bedsLoading, setBedsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const seenInboxRevisionRef = useRef(inboxRevision)

  const fetchStats = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const { data: res } = await doctorConsultationService.getStats()
      setStats(
        res.data ?? {
          waiting: 0,
          in_consultation: 0,
          completed: 0,
          completed_today: 0,
          today: 0,
        },
      )
      return true
    } catch (err) {
      if (!silent) {
        showError(getApiErrorMessage(err, 'Failed to load dashboard stats.'))
      }
      return false
    } finally {
      if (!silent) setLoading(false)
    }
  }, [showError])

  const fetchBedOverview = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setBedsLoading(true)
    try {
      const { data: res } = await bedService.summary()
      const payload = res?.data || {}
      const summary = payload.summary || {}
      const total = Number(summary.total) || 0
      const occupied = Number(summary.occupied) || 0
      const available = Number(summary.available) || 0
      const currentInpatients =
        payload.current_inpatients != null
          ? Number(payload.current_inpatients) || 0
          : occupied
      const occupancyPercent =
        payload.occupancy_percent != null
          ? Number(payload.occupancy_percent) || 0
          : total > 0
            ? Math.round((occupied / total) * 100)
            : 0
      setBedOverview({
        total,
        occupied,
        available,
        currentInpatients,
        occupancyPercent,
      })
      return true
    } catch (err) {
      if (!silent) {
        showError(getApiErrorMessage(err, 'Failed to load bed overview.'))
      }
      return false
    } finally {
      if (!silent) setBedsLoading(false)
    }
  }, [showError])

  useEffect(() => {
    void fetchStats()
    void fetchBedOverview()
  }, [fetchStats, fetchBedOverview])

  // Bed/admission/status events arrive over the existing Socket.IO notification channel.
  useEffect(() => {
    if (seenInboxRevisionRef.current === inboxRevision) return
    seenInboxRevisionRef.current = inboxRevision
    void fetchStats({ silent: true })
    void fetchBedOverview({ silent: true })
  }, [inboxRevision, fetchStats, fetchBedOverview])

  const handleRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      const [statsOk, bedsOk] = await Promise.all([
        fetchStats({ silent: true }),
        fetchBedOverview({ silent: true }),
      ])
      if (!statsOk || !bedsOk) {
        showError('Failed to refresh dashboard.')
      }
    } finally {
      setRefreshing(false)
    }
  }

  const bedValue = (key) => {
    if (bedsLoading) return '—'
    if (key === 'occupancyPercent') return `${bedOverview.occupancyPercent}%`
    return String(bedOverview[key] ?? 0)
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

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-foreground">Bed Overview</h3>
            <p className="mt-1 text-sm text-muted">
              Live bed occupancy from the beds module.
            </p>
          </div>
          <Link
            to={ROUTES.ADMIN_BEDS}
            className="inline-flex items-center gap-0.5 text-sm font-semibold text-primary-600 transition-colors hover:text-primary-700"
          >
            View Beds
            <MdOutlineKeyboardArrowRight className="h-5 w-5" />
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {bedOverviewCards.map((card) => (
            <BedStatCard
              key={card.key}
              title={card.title}
              value={bedValue(card.key)}
              hint={card.hint}
              tone={card.tone}
              icon={card.icon}
              onClick={() => navigate(ROUTES.ADMIN_BEDS)}
            />
          ))}
        </div>
      </section>

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
