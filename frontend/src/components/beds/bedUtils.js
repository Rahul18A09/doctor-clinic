import { BED_STATUS, BED_STATUS_LABELS, ROOM_TYPE_OPTIONS } from '@/utils/constants'

const EMPTY_COUNTS = {
  available: 0,
  occupied: 0,
  reserved: 0,
  maintenance: 0,
  blocked: 0,
}

export function roomTypeLabel(value) {
  return ROOM_TYPE_OPTIONS.find((option) => option.value === value)?.label || value || '—'
}

export const ROOM_TYPE_FORM_OPTIONS = ROOM_TYPE_OPTIONS.filter((option) => option.value !== 'WARD')

export function roomTypeBadgeClass(value) {
  switch (value) {
    case 'GENERAL':
      return 'bg-blue-50 text-blue-700'
    case 'PRIVATE':
      return 'bg-purple-50 text-purple-700'
    case 'SEMI_PRIVATE':
      return 'bg-slate-100 text-slate-600'
    case 'ICU':
      return 'bg-indigo-50 text-indigo-800'
    case 'EMERGENCY':
      return 'bg-red-50 text-red-700'
    case 'WARD':
      return 'bg-teal-50 text-teal-700'
    default:
      return 'bg-gray-100 text-gray-600'
  }
}

export function bedStatusLabel(status) {
  return BED_STATUS_LABELS[status] || status || '—'
}

export function countBedsByStatus(beds = []) {
  return beds.reduce(
    (counts, bed) => {
      if (bed?.status && counts[bed.status] !== undefined) {
        counts[bed.status] += 1
      }
      return counts
    },
    { ...EMPTY_COUNTS },
  )
}

export function canAssignBed(bed) {
  return bed?.status === BED_STATUS.AVAILABLE
}

export function canReleaseBed(bed) {
  return bed?.status === BED_STATUS.OCCUPIED || bed?.status === BED_STATUS.RESERVED
}

export function applyApiFieldErrors(setError, error) {
  const errors = error.response?.data?.errors
  if (!errors || typeof errors !== 'object') return false

  let applied = false
  for (const [key, value] of Object.entries(errors)) {
    const message = Array.isArray(value) ? value[0] : value
    if (message) {
      setError(key, { type: 'server', message: String(message) })
      applied = true
    }
  }
  return applied
}

export function formatAssignedAt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
