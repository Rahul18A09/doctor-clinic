import { ROLES, ROUTES } from '@/utils/constants'
import { formatRelativeTime, formatDateTime as formatNotificationTime } from '@/utils/datetime'

export { formatRelativeTime, formatNotificationTime }

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
