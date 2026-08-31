import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

function NavIcon({ children }) {
  return <span className="flex h-5 w-5 shrink-0 items-center justify-center">{children}</span>
}

export function Sidebar({ items, title, brandSrc }) {
  const { logout, user } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-card shadow-sm lg:flex">
      <div className="flex h-16 items-center gap-3 border-b border-border px-4 sm:px-6">
        {brandSrc ? (
          <img src={brandSrc} alt="" className="h-10 w-10 shrink-0 object-contain" />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-sm font-bold text-white">
            Dr
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">{title}</p>
          <p className="truncate text-xs text-muted capitalize">{user?.role?.toLowerCase()}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {items.map((item) =>
          item.action === 'logout' ? (
            <button
              key={item.label}
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition-all duration-200 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
            >
              <NavIcon>{item.icon}</NavIcon>
              {item.label}
            </button>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/30'
                    : 'text-muted hover:bg-surface hover:text-foreground'
                }`
              }
            >
              <NavIcon>{item.icon}</NavIcon>
              {item.label}
            </NavLink>
          ),
        )}
      </nav>
    </aside>
  )
}
