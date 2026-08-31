import clinicLogo from '@/assets/logo.svg'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { ROUTES } from '@/utils/constants'

const icons = {
  dashboard: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  users: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  patients: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-5 w-5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0"
      />
      <circle cx="18.5" cy="17.5" r="3.25" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M18.5 16v3M17 17.5h3" />
    </svg>
  ),
  consultations: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  completed: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  reports: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  settings: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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
}

const adminNavItems = [
  { label: 'Dashboard', to: ROUTES.ADMIN_DASHBOARD, icon: icons.dashboard, end: true },
  { label: 'Receptionists', to: ROUTES.ADMIN_RECEPTIONISTS, icon: icons.users, end: true },
  { label: 'Patients', to: ROUTES.ADMIN_PATIENTS, icon: icons.patients, end: true },
  { label: 'Consultations', to: `${ROUTES.ADMIN_CONSULTATIONS}?tab=waiting`, icon: icons.consultations, end: true },
  { label: 'Reports', to: ROUTES.ADMIN_REPORTS, icon: icons.reports, end: true },
  { label: 'Settings', to: ROUTES.ADMIN_SETTINGS, icon: icons.settings, end: true },
  { label: 'Notifications', to: ROUTES.ADMIN_NOTIFICATIONS, icon: icons.notifications, end: true },
  { label: 'Profile', to: ROUTES.ADMIN_PROFILE, icon: icons.profile, end: true },
]

const adminMobileNavItems = [
  { label: 'Dashboard', to: ROUTES.ADMIN_DASHBOARD, icon: icons.dashboard, end: true },
  { label: 'Receptionists', to: ROUTES.ADMIN_RECEPTIONISTS, icon: icons.users, match: 'prefix' },
  { label: 'Patients', to: ROUTES.ADMIN_PATIENTS, icon: icons.patients, match: 'prefix' },
  {
    label: 'Consultations',
    to: `${ROUTES.ADMIN_CONSULTATIONS}?tab=waiting`,
    icon: icons.consultations,
    match: 'prefix',
  },
  { label: 'Reports', to: ROUTES.ADMIN_REPORTS, icon: icons.reports, end: true },
  { label: 'Settings', to: ROUTES.ADMIN_SETTINGS, icon: icons.settings, end: true },
  {
    label: 'Notifications',
    to: ROUTES.ADMIN_NOTIFICATIONS,
    icon: icons.notifications,
    end: true,
    badge: 'unread',
  },
  { label: 'Profile', to: ROUTES.ADMIN_PROFILE, icon: icons.profile, end: true },
]

export function AdminLayout() {
  return (
    <DashboardShell
      items={adminNavItems}
      mobileItems={adminMobileNavItems}
      title="Admin Panel"
      subtitle="Administrator Dashboard"
      brandSrc={clinicLogo}
    />
  )
}
