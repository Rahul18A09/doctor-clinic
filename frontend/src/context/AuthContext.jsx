import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { authService } from '@/api/auth'
import { clearTokens, getStorage, getToken, setUnauthorizedHandler } from '@/api/axios'
import {
  REFRESH_TOKEN_KEY,
  REMEMBER_ME_KEY,
  TOKEN_KEY,
  USER_KEY,
} from '@/utils/constants'
import { invalidateSessionCache } from '@/utils/sessionCache'

const AuthContext = createContext(null)

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function hasCachedSession() {
  return Boolean(getToken(TOKEN_KEY) && readStoredUser())
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser)
  const [accessToken, setAccessToken] = useState(() => getToken(TOKEN_KEY))
  // Only block the shell when we have a token but no cached user to paint with.
  const [loading, setLoading] = useState(() => Boolean(getToken(TOKEN_KEY) && !readStoredUser()))
  const refreshInFlightRef = useRef(null)

  const isAuthenticated = Boolean(accessToken && user)

  const persistSession = useCallback((tokens, userData, rememberMe = true) => {
    const storage = rememberMe ? localStorage : sessionStorage
    ;[localStorage, sessionStorage].forEach((s) => {
      s.removeItem(TOKEN_KEY)
      s.removeItem(REFRESH_TOKEN_KEY)
      s.removeItem(USER_KEY)
    })

    storage.setItem(TOKEN_KEY, tokens.access)
    storage.setItem(REFRESH_TOKEN_KEY, tokens.refresh)
    storage.setItem(USER_KEY, JSON.stringify(userData))
    localStorage.setItem(REMEMBER_ME_KEY, rememberMe ? 'true' : 'false')

    setAccessToken(tokens.access)
    setUser(userData)
  }, [])

  const logout = useCallback(async () => {
    try {
      if (getToken(TOKEN_KEY)) {
        await authService.logout()
      }
    } catch {
      // Ignore logout API errors — clear client session regardless
    } finally {
      clearTokens()
      invalidateSessionCache()
      refreshInFlightRef.current = null
      setAccessToken(null)
      setUser(null)
    }
  }, [])

  const login = useCallback(
    async (credentials, rememberMe = true) => {
      const { data: response } = await authService.login(credentials)
      const { access, refresh, user: userData } = response.data
      invalidateSessionCache()
      persistSession({ access, refresh }, userData, rememberMe)
      return userData
    },
    [persistSession],
  )

  const refreshUser = useCallback(async () => {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current
    }

    const request = (async () => {
      const { data: response } = await authService.getCurrentUser()
      const userData = response.data.user
      getStorage().setItem(USER_KEY, JSON.stringify(userData))
      setUser(userData)
      return userData
    })()

    refreshInFlightRef.current = request
    try {
      return await request
    } finally {
      if (refreshInFlightRef.current === request) {
        refreshInFlightRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      invalidateSessionCache()
      setAccessToken(null)
      setUser(null)
    })
  }, [])

  useEffect(() => {
    let cancelled = false

    async function bootstrapAuth() {
      const token = getToken(TOKEN_KEY)
      if (!token) {
        if (!cancelled) setLoading(false)
        return
      }

      // Cached session: render immediately, validate /me in the background.
      if (hasCachedSession()) {
        if (!cancelled) {
          setAccessToken(token)
          setLoading(false)
        }
      }

      try {
        await refreshUser()
        if (!cancelled) setAccessToken(token)
      } catch {
        if (!cancelled) {
          clearTokens()
          invalidateSessionCache()
          setAccessToken(null)
          setUser(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void bootstrapAuth()
    return () => {
      cancelled = true
    }
  }, [refreshUser])

  const value = useMemo(
    () => ({
      user,
      accessToken,
      isAuthenticated,
      loading,
      login,
      logout,
      refreshUser,
    }),
    [user, accessToken, isAuthenticated, loading, login, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}
