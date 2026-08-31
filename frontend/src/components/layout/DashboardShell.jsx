import { Outlet } from 'react-router-dom'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'

export function DashboardShell({ items, mobileItems, title, subtitle, brandSrc }) {
  return (
    <div className="min-h-dvh bg-surface">
      <Sidebar items={items} title={title} brandSrc={brandSrc} />
      <div className="w-full min-w-0 lg:pl-64">
        <DashboardHeader subtitle={subtitle} />
        <main className="w-full min-w-0 p-4 pb-36 sm:p-5 lg:p-6 lg:pb-6">
          <Outlet />
        </main>
      </div>
      <BottomNav items={mobileItems || items} />
    </div>
  )
}
