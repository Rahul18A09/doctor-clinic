import { useState } from 'react'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { useAuth } from '@/hooks/useAuth'
import { CLINIC_NAME } from '@/utils/constants'

function UserAvatar({ name, size = 'md' }) {
  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-9 w-9 text-sm',
  }
  const initial = name?.trim()?.charAt(0)?.toUpperCase() || 'U'

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-primary-600 font-bold text-white shadow-sm ring-2 ring-primary-100 ${sizes[size]}`}
      aria-hidden="true"
    >
      {initial}
    </div>
  )
}

export function DashboardHeader({ subtitle, onMenuClick }) {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-20 flex h-16 min-w-0 items-center justify-between gap-2 overflow-visible border-b border-border bg-card/80 px-3 backdrop-blur-md sm:gap-3 sm:px-5 lg:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {onMenuClick && (
          <button
            type="button"
            className="shrink-0 rounded-xl p-2 text-muted transition-colors hover:bg-surface hover:text-foreground lg:hidden"
            onClick={onMenuClick}
            aria-label="Open menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold text-foreground sm:text-lg">{CLINIC_NAME}</h1>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <NotificationBell />

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-surface sm:px-3"
          >
            <UserAvatar name={user?.full_name} />
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium text-foreground">{user?.full_name}</p>
              <p className="text-xs text-muted capitalize">{user?.role?.toLowerCase()}</p>
            </div>
            <svg className="h-4 w-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-border bg-card py-1 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                  <UserAvatar name={user?.full_name} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{user?.full_name}</p>
                    <p className="truncate text-xs text-muted">{user?.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setMenuOpen(false)
                    await logout()
                    window.location.href = '/login'
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
