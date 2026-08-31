import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

const AuthContext = createContext(null)

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser)
  const [accessToken, setAccessToken] = useState(() => getToken(TOKEN_KEY))
  const [loading, setLoading] = useState(true)

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
      setAccessToken(null)
      setUser(null)
    }
  }, [])

  const login = useCallback(
    async (credentials, rememberMe = true) => {
      console.log('[AuthContext.login] called with:', credentials)
      const { data: response } = await authService.login(credentials)
      console.log('[AuthContext.login] API response:', response)
      const { access, refresh, user: userData } = response.data
      persistSession({ access, refresh }, userData, rememberMe)
      return userData
    },
    [persistSession],
  )

  const refreshUser = useCallback(async () => {
    const { data: response } = await authService.getCurrentUser()
    const userData = response.data.user
    getStorage().setItem(USER_KEY, JSON.stringify(userData))
    setUser(userData)
    return userData
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAccessToken(null)
      setUser(null)
    })
  }, [])

  useEffect(() => {
    async function bootstrapAuth() {
      const token = getToken(TOKEN_KEY)
      if (!token) {
        setLoading(false)
        return
      }

      try {
        await refreshUser()
        setAccessToken(token)
      } catch {
        clearTokens()
        setAccessToken(null)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    bootstrapAuth()
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
