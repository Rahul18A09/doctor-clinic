function isLoopbackHostname(hostname) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '0.0.0.0'
  )
}

function isLoopbackUrl(url) {
  try {
    const parsed = new URL(url, 'http://localhost')
    return isLoopbackHostname(parsed.hostname)
  } catch {
    return false
  }
}

/**
 * Resolve API base URL.
 * When the configured API is loopback (or unset), use same-origin `/api/v1`
 * so Vite dev, Vite preview, LAN/mobile, and reverse-proxy deploys never
 * call 127.0.0.1 on the client.
 */
function resolveApiBaseUrl() {
  const configured =
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    ''

  if (typeof window !== 'undefined' && (!configured || isLoopbackUrl(configured))) {
    return '/api/v1'
  }

  return configured || 'http://127.0.0.1:8001/api/v1'
}

export const API_BASE_URL = resolveApiBaseUrl()

export const TOKEN_KEY = 'access_token'
export const REFRESH_TOKEN_KEY = 'refresh_token'
export const USER_KEY = 'user'
export const REMEMBER_ME_KEY = 'remember_me'

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  QUEUE: '/queue',
  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_RECEPTIONISTS: '/admin/receptionists',
  ADMIN_RECEPTIONISTS_ADD: '/admin/receptionists/new',
  ADMIN_RECEPTIONISTS_EDIT: '/admin/receptionists/:id/edit',
  ADMIN_PATIENTS: '/admin/patients',
  ADMIN_PATIENT_DETAIL: '/admin/patients/:id',
  ADMIN_PATIENT_EDIT: '/admin/patients/:id/edit',
  ADMIN_CONSULTATIONS: '/admin/consultations',
  ADMIN_CONSULTATION: '/admin/consultations/:id',
  ADMIN_COMPLETED: '/admin/completed',
  ADMIN_REPORTS: '/admin/reports',
  ADMIN_PROFILE: '/admin/profile',
  ADMIN_SETTINGS: '/admin/settings',
  ADMIN_NOTIFICATIONS: '/admin/notifications',
  RECEPTION_DASHBOARD: '/reception/dashboard',
  RECEPTION_PATIENTS: '/reception/patients',
  RECEPTION_PATIENTS_ADD: '/reception/patients/new',
  RECEPTION_PATIENT_EDIT: '/reception/patients/:id/edit',
  RECEPTION_PATIENT_DETAIL: '/reception/patients/:id',
  RECEPTION_PROFILE: '/reception/profile',
  RECEPTION_NOTIFICATIONS: '/reception/notifications',
}

export const GENDERS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
]

export const BLOOD_GROUPS = [
  { value: 'A+', label: 'A+' },
  { value: 'A-', label: 'A-' },
  { value: 'B+', label: 'B+' },
  { value: 'B-', label: 'B-' },
  { value: 'AB+', label: 'AB+' },
  { value: 'AB-', label: 'AB-' },
  { value: 'O+', label: 'O+' },
  { value: 'O-', label: 'O-' },
]

export const PATIENT_STATUS = {
  WAITING: 'WAITING',
  IN_CONSULTATION: 'IN_CONSULTATION',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
}

export const PATIENT_STATUS_LABELS = {
  WAITING: 'Waiting',
  IN_CONSULTATION: 'In Consultation',
  COMPLETED: 'Completed',
}

export const PATIENT_STATUS_FILTER_OPTIONS = [
  { value: 'WAITING', label: 'Waiting' },
  { value: 'IN_CONSULTATION', label: 'In Consultation' },
  { value: 'COMPLETED', label: 'Completed' },
]

export const PATIENT_FILTERS = [
  { value: '', label: 'All Patients' },
  { value: 'today', label: "Today's Patients" },
  { value: 'waiting', label: 'Waiting' },
  { value: 'completed', label: 'Completed' },
]

export const CONSULTATION_TABS = {
  WAITING: 'waiting',
  IN_CONSULTATION: 'in_consultation',
  COMPLETED: 'completed',
}

export const CONSULTATION_TAB_LABELS = {
  [CONSULTATION_TABS.WAITING]: 'Waiting',
  [CONSULTATION_TABS.IN_CONSULTATION]: 'In Consultation',
  [CONSULTATION_TABS.COMPLETED]: 'Completed',
}

export const ROLES = {
  ADMIN: 'ADMIN',
  RECEPTIONIST: 'RECEPTIONIST',
}

export const ROLE_DASHBOARD = {
  [ROLES.ADMIN]: ROUTES.ADMIN_DASHBOARD,
  [ROLES.RECEPTIONIST]: ROUTES.RECEPTION_DASHBOARD,
}

export const CLINIC_NAME = 'Doctor Clinic'
