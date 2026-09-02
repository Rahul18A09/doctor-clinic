import clinicLogo from '@/assets/logo.svg'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { ROUTES } from '@/utils/constants'

const icons = {
  dashboard: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  add: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  ),
  list: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  profile: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  notifications: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  beds: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 18V9a2 2 0 012-2h4a3 3 0 016 0h4a2 2 0 012 2v9M3 14h18M7 18v2M17 18v2" />
    </svg>
  ),
}

const receptionNavItems = [
  { label: 'Dashboard', to: ROUTES.RECEPTION_DASHBOARD, icon: icons.dashboard, end: true },
  { label: 'Add Patient', to: ROUTES.RECEPTION_PATIENTS_ADD, icon: icons.add, end: true },
  { label: 'Patient List', to: `${ROUTES.RECEPTION_PATIENTS}?filter=today`, icon: icons.list, end: true },
  { label: 'Bed Availability', to: ROUTES.RECEPTION_BEDS, icon: icons.beds, end: true },
  { label: 'Notifications', to: ROUTES.RECEPTION_NOTIFICATIONS, icon: icons.notifications, end: true },
  { label: 'Profile', to: ROUTES.RECEPTION_PROFILE, icon: icons.profile, end: true },
]

const receptionMobileNavItems = [
  { label: 'Dashboard', to: ROUTES.RECEPTION_DASHBOARD, icon: icons.dashboard, end: true },
  { label: 'Add Patient', to: ROUTES.RECEPTION_PATIENTS_ADD, icon: icons.add, end: true },
  {
    label: 'Patients',
    to: `${ROUTES.RECEPTION_PATIENTS}?filter=today`,
    icon: icons.list,
    match: 'patientsList',
  },
  { label: 'Beds', to: ROUTES.RECEPTION_BEDS, icon: icons.beds, end: true },
  {
    label: 'Notifications',
    to: ROUTES.RECEPTION_NOTIFICATIONS,
    icon: icons.notifications,
    end: true,
    badge: 'unread',
  },
  { label: 'Profile', to: ROUTES.RECEPTION_PROFILE, icon: icons.profile, end: true },
]

export function ReceptionistLayout() {
  return (
    <DashboardShell
      items={receptionNavItems}
      mobileItems={receptionMobileNavItems}
      title="Reception"
      subtitle="Receptionist Dashboard"
      brandSrc={clinicLogo}
    />
  )
}
