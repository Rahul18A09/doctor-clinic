import { NavLink, useLocation } from 'react-router-dom'
import { useNotifications } from '@/hooks/useNotifications'

function pathOf(to) {
  return String(to).split('?')[0]
}

function isBottomNavActive(item, pathname) {
  const path = pathOf(item.to)
  if (item.match === 'patientsList') {
    if (pathname === path) return true
    return pathname.startsWith(`${path}/`) && pathname !== `${path}/new`
  }
  if (item.match === 'prefix') {
    return pathname === path || pathname.startsWith(`${path}/`)
  }
  return pathname === path
}

function unreadLabel(count) {
  if (count > 99) return '99+'
  return String(count)
}

export function BottomNav({ items }) {
  const location = useLocation()
  const { unreadCount } = useNotifications()

  if (!items?.length) return null

  const scrollable = items.length > 6

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md lg:hidden"
      aria-label="Mobile navigation"
    >
      <div
        className={
          scrollable
            ? 'bottom-nav-scroll hide-scrollbar flex flex-nowrap items-stretch'
            : 'flex items-stretch'
        }
      >
        {items.map((item) => {
          const active = isBottomNavActive(item, location.pathname)
          const showUnread = item.badge === 'unread' && unreadCount > 0
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium leading-tight ${
                scrollable
                  ? 'w-[4.75rem] shrink-0 grow-0'
                  : 'min-w-0 flex-1'
              } ${active ? 'text-primary-600' : 'text-muted'}`}
            >
              <span className="relative flex h-6 w-6 items-center justify-center">
                {item.icon}
                {showUnread && (
                  <span className="absolute -right-1.5 -top-1 min-w-4 rounded-full bg-red-500 px-1 text-[9px] font-bold leading-4 text-white">
                    {unreadLabel(unreadCount)}
                  </span>
                )}
              </span>
              <span className="w-full truncate text-center">{item.label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
