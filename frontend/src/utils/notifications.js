import { ROLES, ROUTES } from '@/utils/constants'

export const NOTIFICATION_TYPES = {
  PATIENT: 'patient',
  TOKEN: 'token',
  QUEUE: 'queue',
  CONSULTATION: 'consultation',
  STAFF: 'staff',
  SYSTEM: 'system',
}

export const NOTIFICATION_TYPE_LABELS = {
  patient: 'Patient',
  token: 'Token',
  queue: 'Queue',
  consultation: 'Consultation',
  staff: 'Staff',
  receptionist: 'Staff',
  system: 'System',
}

export const NOTIFICATION_TYPE_BADGE = {
  patient: 'info',
  token: 'warning',
  queue: 'warning',
  consultation: 'success',
  staff: 'default',
  receptionist: 'default',
  system: 'default',
}

export const RECEPTIONIST_NOTIFICATION_FILTER_OPTIONS = [
  { value: 'patient', label: 'Patient' },
  { value: 'consultation', label: 'Consultation' },
]

export const DOCTOR_NOTIFICATION_FILTER_OPTIONS = [
  { value: 'queue', label: 'Queue' },
  { value: 'consultation', label: 'Consultation' },
  { value: 'staff', label: 'Staff' },
]

export function notificationFilterOptionsForRole(role) {
  if (role === ROLES.ADMIN) return DOCTOR_NOTIFICATION_FILTER_OPTIONS
  return RECEPTIONIST_NOTIFICATION_FILTER_OPTIONS
}

export function notificationTypeQueryValue(filterValue) {
  if (!filterValue) return undefined
  return filterValue
}

export function relatedPatientIdFromNotification(item) {
  const related = String(item?.related_id || '').trim()
  const prefixed = related.match(/^(?:pr|q|cs|cc|cx|ba|br|ar):([a-f0-9]{24})(?:$|:)/i)
  if (prefixed) return prefixed[1].toLowerCase()
  if (/^[a-f0-9]{24}$/i.test(related)) return related.toLowerCase()
  return ''
}

function isBedMaintenanceNotification(item) {
  const related = String(item?.related_id || '')
  const title = String(item?.title || '').trim().toLowerCase()
  return related.startsWith('bm:') || title === 'bed marked for maintenance'
}

/** In-app destination for a notification, or '' if there is none. */
export function notificationTargetPath(item, role) {
  const type = String(item?.type || '')
  const isAdmin = role === ROLES.ADMIN
  const patientId = relatedPatientIdFromNotification(item)

  if (isBedMaintenanceNotification(item)) {
    return isAdmin ? ROUTES.ADMIN_BEDS : ROUTES.RECEPTION_BEDS
  }

  if (type === 'staff' || type === 'receptionist') {
    return isAdmin ? ROUTES.ADMIN_RECEPTIONISTS : ''
  }

  if (!patientId) return ''

  if (isAdmin) {
    if (type === 'patient') {
      return ROUTES.ADMIN_PATIENT_DETAIL.replace(':id', patientId)
    }
    return ROUTES.ADMIN_CONSULTATION.replace(':id', patientId)
  }

  if (type === 'patient' || type === 'consultation') {
    return ROUTES.RECEPTION_PATIENT_DETAIL.replace(':id', patientId)
  }

  return ''
}

export function formatRelativeTime(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 45) return 'Just now'
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatNotificationTime(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
