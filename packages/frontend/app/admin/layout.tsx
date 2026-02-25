import React from 'react'
import DashboardLayout from '@/app/(dashboard)/layout'
import SidebarNavigation from '@/app/admin/components/SidebarNavigation'

export default function AdminLayout({
  children, // will be a page or nested layout
}: {
  children: React.ReactNode
}) {
  return (
    <DashboardLayout adminPage={true}>
      <h2>Administration</h2>
      <div className="mt-5 w-full gap-8 space-y-3 md:grid md:grid-cols-10 md:space-y-0">
        <SidebarNavigation />
        <div className="md:col-span-8">{children}</div>
      </div>
    </DashboardLayout>
  )
}
