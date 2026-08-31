import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { ReceptionistLayout } from '@/components/layout/ReceptionistLayout'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage'
import { AdminProfilePage } from '@/pages/admin/AdminProfilePage'
import { AdminReportsPage } from '@/pages/admin/AdminReportsPage'
import { AdminSettingsPage } from '@/pages/admin/AdminSettingsPage'
import { ConsultationPage } from '@/pages/admin/ConsultationPage'
import { ConsultationQueuePage } from '@/pages/admin/ConsultationQueuePage'
import { ReceptionistFormPage } from '@/pages/admin/ReceptionistFormPage'
import { ReceptionistListPage } from '@/pages/admin/ReceptionistListPage'
import {
  AdminPatientListPage,
  ReceptionPatientListPage,
} from '@/pages/patients/PatientListPage'
import {
  AdminPatientDetailPage,
  ReceptionPatientDetailPage,
} from '@/pages/patients/PatientDetailPage'
import { PatientFormPage, AdminPatientFormPage, ReceptionPatientFormPage } from '@/pages/patients/PatientFormPage'
import { ReceptionistDashboardPage } from '@/pages/reception/ReceptionistDashboardPage'
import { ReceptionistProfilePage } from '@/pages/reception/ReceptionistProfilePage'
import { NotificationsPage } from '@/pages/notifications/NotificationsPage'
import { QueuePage } from '@/pages/QueuePage'
import { GuestRoute, RootRedirect } from '@/routes/GuestRoute'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { ROLES, ROUTES } from '@/utils/constants'

export function AppRoutes() {
  return (
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
          <Route path="/reception/add-patient" element={<ReceptionPatientFormPage />} />
          <Route path={ROUTES.RECEPTION_PROFILE} element={<ReceptionistProfilePage />} />
          <Route path={ROUTES.RECEPTION_NOTIFICATIONS} element={<NotificationsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
