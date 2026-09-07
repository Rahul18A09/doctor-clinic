import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

function NavIcon({ children }) {
  return <span className="flex h-5 w-5 shrink-0 items-center justify-center">{children}</span>
}

function HamburgerIcon() {
  return (
    <svg className="h-4 w-4 text-muted" viewBox="0 0 20 16" fill="none" aria-hidden="true">
      <path d="M1 2h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M1 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M1 14h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function Sidebar({ items, title, brandSrc, collapsed = false, onToggleCollapse }) {
  const { logout, user } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const itemClass = (isActive) =>
    `flex items-center rounded-xl py-2.5 text-sm font-medium transition-all duration-200 ${
      collapsed ? 'justify-center px-2' : 'gap-3 px-3'
    } ${
      isActive
        ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/30'
        : 'text-muted hover:bg-surface hover:text-foreground'
    }`

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-card shadow-sm transition-[width] duration-300 ease-in-out lg:flex ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div
        className={`relative flex h-16 items-center border-b border-border ${
          collapsed ? 'justify-center px-2' : 'gap-3 px-4 sm:px-6'
        }`}
      >
        {brandSrc ? (
          <img src={brandSrc} alt="" className="h-10 w-10 shrink-0 object-contain" />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-sm font-bold text-white">
            Dr
          </div>
        )}
        <div
          className={`min-w-0 flex-1 overflow-hidden transition-opacity duration-200 ${
            collapsed ? 'pointer-events-none w-0 opacity-0' : 'opacity-100'
          }`}
        >
          <p className="truncate text-sm font-bold text-foreground">{title}</p>
          <p className="truncate text-xs text-muted capitalize">{user?.role?.toLowerCase()}</p>
        </div>

        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            className="absolute top-1/2 right-0 z-50 flex h-8 w-8 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-border bg-card shadow-md transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <HamburgerIcon />
          </button>
        )}
      </div>

      <nav className={`flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-3 ${collapsed ? 'px-2' : 'p-4'}`}>
        {items.map((item) =>
          item.action === 'logout' ? (
            <button
              key={item.label}
              type="button"
              onClick={handleLogout}
              title={collapsed ? item.label : undefined}
              className={`flex w-full items-center rounded-xl py-2.5 text-sm font-medium text-muted transition-all duration-200 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 ${
                collapsed ? 'justify-center px-2' : 'gap-3 px-3'
              }`}
            >
              <NavIcon>{item.icon}</NavIcon>
              <span className={collapsed ? 'sr-only' : undefined}>{item.label}</span>
            </button>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) => itemClass(isActive)}
            >
              <NavIcon>{item.icon}</NavIcon>
              <span className={collapsed ? 'sr-only' : undefined}>{item.label}</span>
            </NavLink>
          ),
        )}
      </nav>
    </aside>
  )
}
