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
