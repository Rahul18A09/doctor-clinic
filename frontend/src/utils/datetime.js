/**
 * Shared API datetime helpers.
 *
 * Backend returns ISO 8601 UTC (`…Z`). Display uses the browser's local timezone
 * via `toLocale*` / `Intl` without hardcoding Asia/Kolkata.
 */

const HAS_TIMEZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i

/**
 * Parse an API timestamp. Values with Z/offset are used as-is.
 * Legacy naive strings (no zone) are treated as UTC to avoid double-local display.
 */
export function parseApiDate(value) {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const raw = String(value).trim()
  if (!raw) return null

  const normalized = HAS_TIMEZONE.test(raw) ? raw : `${raw}Z`
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

const DATE_TIME_OPTS = {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}

const DATE_OPTS = {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
}

/** Full date + time in the user's local timezone. */
export function formatDateTime(value, empty = '—') {
  const date = parseApiDate(value)
  if (!date) return empty
  return date.toLocaleString(undefined, DATE_TIME_OPTS)
}

/** Date only in the user's local timezone. */
export function formatDate(value, empty = '—') {
  const date = parseApiDate(value)
  if (!date) return empty
  return date.toLocaleDateString(undefined, DATE_OPTS)
}

/** Relative label for recent notifications; falls back to local date. */
export function formatRelativeTime(value, empty = '—') {
  const date = parseApiDate(value)
  if (!date) return empty
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)
  if (seconds < 45) return 'Just now'
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return formatDate(date, empty)
}
