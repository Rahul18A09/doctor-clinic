import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { ReceptionistLayout } from '@/components/layout/ReceptionistLayout'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { GuestRoute, RootRedirect } from '@/routes/GuestRoute'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { ROLES, ROUTES } from '@/utils/constants'

const AdminDashboardPage = lazy(() =>
  import('@/pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
)
const AdminProfilePage = lazy(() =>
  import('@/pages/admin/AdminProfilePage').then((m) => ({ default: m.AdminProfilePage })),
)
const AdminReportsPage = lazy(() =>
  import('@/pages/admin/AdminReportsPage').then((m) => ({ default: m.AdminReportsPage })),
)
const AdminSettingsPage = lazy(() =>
  import('@/pages/admin/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage })),
)
const ConsultationPage = lazy(() =>
  import('@/pages/admin/ConsultationPage').then((m) => ({ default: m.ConsultationPage })),
)
const ConsultationQueuePage = lazy(() =>
  import('@/pages/admin/ConsultationQueuePage').then((m) => ({
    default: m.ConsultationQueuePage,
  })),
)
const ReceptionistFormPage = lazy(() =>
  import('@/pages/admin/ReceptionistFormPage').then((m) => ({
    default: m.ReceptionistFormPage,
  })),
)
const ReceptionistListPage = lazy(() =>
  import('@/pages/admin/ReceptionistListPage').then((m) => ({
    default: m.ReceptionistListPage,
  })),
)
const AdminPatientListPage = lazy(() =>
  import('@/pages/patients/PatientListPage').then((m) => ({
    default: m.AdminPatientListPage,
  })),
)
const ReceptionPatientListPage = lazy(() =>
  import('@/pages/patients/PatientListPage').then((m) => ({
    default: m.ReceptionPatientListPage,
  })),
)
const AdminPatientDetailPage = lazy(() =>
  import('@/pages/patients/PatientDetailPage').then((m) => ({
    default: m.AdminPatientDetailPage,
  })),
)
const ReceptionPatientDetailPage = lazy(() =>
  import('@/pages/patients/PatientDetailPage').then((m) => ({
    default: m.ReceptionPatientDetailPage,
  })),
)
const AdminPatientFormPage = lazy(() =>
  import('@/pages/patients/PatientFormPage').then((m) => ({
    default: m.AdminPatientFormPage,
  })),
)
const ReceptionPatientFormPage = lazy(() =>
  import('@/pages/patients/PatientFormPage').then((m) => ({
    default: m.ReceptionPatientFormPage,
  })),
)
const AdminBedsPage = lazy(() =>
  import('@/pages/beds/BedManagementPage').then((m) => ({ default: m.AdminBedsPage })),
)
const ReceptionBedsPage = lazy(() =>
  import('@/pages/beds/BedManagementPage').then((m) => ({ default: m.ReceptionBedsPage })),
)
const ReceptionistDashboardPage = lazy(() =>
  import('@/pages/reception/ReceptionistDashboardPage').then((m) => ({
    default: m.ReceptionistDashboardPage,
  })),
)
const ReceptionistProfilePage = lazy(() =>
  import('@/pages/reception/ReceptionistProfilePage').then((m) => ({
    default: m.ReceptionistProfilePage,
  })),
)
const NotificationsPage = lazy(() =>
  import('@/pages/notifications/NotificationsPage').then((m) => ({
    default: m.NotificationsPage,
  })),
)
const QueuePage = lazy(() =>
  import('@/pages/QueuePage').then((m) => ({ default: m.QueuePage })),
)

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center py-16">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
    </div>
  )
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<RootRedirect />} />

        <Route
          path="/login"
          element={
            <GuestRoute>
              <LoginPage />
            </GuestRoute>
          }
        />

        <Route path={ROUTES.QUEUE} element={<QueuePage />} />

        <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/receptionists" element={<ReceptionistListPage />} />
            <Route path="/admin/receptionists/new" element={<ReceptionistFormPage />} />
            <Route path="/admin/receptionists/:id/edit" element={<ReceptionistFormPage />} />
            <Route path="/admin/patients" element={<AdminPatientListPage />} />
            <Route path="/admin/patients/new" element={<AdminPatientFormPage />} />
            <Route path="/admin/patients/:id" element={<AdminPatientDetailPage />} />
            <Route path="/admin/patients/:id/edit" element={<AdminPatientFormPage />} />
            <Route path={ROUTES.ADMIN_BEDS} element={<AdminBedsPage />} />
            <Route path="/admin/consultations" element={<ConsultationQueuePage />} />
            <Route path="/admin/consultations/:id" element={<ConsultationPage />} />
            <Route
              path="/admin/completed"
              element={<Navigate to={`${ROUTES.ADMIN_CONSULTATIONS}?tab=completed`} replace />}
            />
            <Route path={ROUTES.ADMIN_REPORTS} element={<AdminReportsPage />} />
            <Route path={ROUTES.ADMIN_SETTINGS} element={<AdminSettingsPage />} />
            <Route path={ROUTES.ADMIN_NOTIFICATIONS} element={<NotificationsPage />} />
            <Route path={ROUTES.ADMIN_PROFILE} element={<AdminProfilePage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={[ROLES.RECEPTIONIST]} />}>
          <Route element={<ReceptionistLayout />}>
            <Route path="/reception/dashboard" element={<ReceptionistDashboardPage />} />
            <Route path="/reception/patients" element={<ReceptionPatientListPage />} />
            <Route path="/reception/patients/new" element={<ReceptionPatientFormPage />} />
            <Route path="/reception/patients/:id" element={<ReceptionPatientDetailPage />} />
            <Route path="/reception/patients/:id/edit" element={<ReceptionPatientFormPage />} />
            <Route path={ROUTES.RECEPTION_BEDS} element={<ReceptionBedsPage />} />
            <Route path="/reception/add-patient" element={<ReceptionPatientFormPage />} />
            <Route path={ROUTES.RECEPTION_PROFILE} element={<ReceptionistProfilePage />} />
            <Route path={ROUTES.RECEPTION_NOTIFICATIONS} element={<NotificationsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
