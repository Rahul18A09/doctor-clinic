import { useCallback, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'

const SIDEBAR_COLLAPSED_KEY = 'dashboard.sidebarCollapsed'

function readCollapsedPreference() {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
}

export function DashboardShell({ items, mobileItems, title, subtitle, brandSrc }) {
  const [collapsed, setCollapsed] = useState(readCollapsedPreference)

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? 'true' : 'false')
    } catch {
      // Ignore storage errors (private mode, quota, etc.).
    }
  }, [collapsed])

  const handleToggleCollapse = useCallback(() => {
    setCollapsed((value) => !value)
  }, [])

  return (
    <div className="min-h-dvh bg-surface">
      <Sidebar
        items={items}
        title={title}
        brandSrc={brandSrc}
        collapsed={collapsed}
        onToggleCollapse={handleToggleCollapse}
      />
      <div
        className={`w-full min-w-0 transition-[padding] duration-300 ease-in-out ${
          collapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        <DashboardHeader subtitle={subtitle} />
        <main className="w-full min-w-0 p-4 pb-24 sm:p-5 lg:p-6 lg:pb-6">
          <Outlet />
        </main>
      </div>
      <BottomNav items={mobileItems || items} />
    </div>
  )
}
