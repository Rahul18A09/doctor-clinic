/**
 * Short-lived in-memory cache for screen data reused across navigations.
 * Not a replacement for Refresh — callers must bypass on explicit refresh.
 */

const store = new Map()

export function getSessionCache(key, maxAgeMs = 30_000) {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() - entry.at > maxAgeMs) {
    store.delete(key)
    return null
  }
  return entry.value
}

export function setSessionCache(key, value) {
  store.set(key, { value, at: Date.now() })
}

export function invalidateSessionCache(prefixOrKey) {
  if (!prefixOrKey) {
    store.clear()
    return
  }
  for (const key of store.keys()) {
    if (key === prefixOrKey || key.startsWith(prefixOrKey)) {
      store.delete(key)
    }
  }
}

export const SESSION_CACHE_KEYS = {
  DOCTOR_STATS: 'doctor:stats',
  PATIENT_STATS: 'patient:stats',
  BED_SUMMARY: 'beds:summary',
}
