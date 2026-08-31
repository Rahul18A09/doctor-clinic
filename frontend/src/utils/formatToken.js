/**
 * Display-only token formatter.
 * Stored/API tokens look like P0001 or YYYYMMDD-P0001; the UI shows 01.
 * Sequence 1 → 01, 12 → 12, 100 → 100. Does not change stored tokens.
 */
export function formatTokenForUi(token) {
  if (token == null || token === '') return token ?? ''

  const value = String(token).trim()
  const suffix = value.includes('-') ? value.slice(value.lastIndexOf('-') + 1) : value
  const withoutPrefix = suffix.replace(/^P(?=\d)/i, '')
  const digits = withoutPrefix.replace(/\D/g, '')
  if (!digits) return withoutPrefix

  const sequence = Number.parseInt(digits, 10)
  if (!Number.isFinite(sequence)) return withoutPrefix
  return String(sequence).padStart(2, '0')
}
