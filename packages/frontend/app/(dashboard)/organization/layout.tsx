import SidebarNavigation from './components/SidebarNavigation'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'HelpMe | Organization Panel',
}

export default function OrganizationLayout({
  children, // will be a page or nested layout
}: {
  children: React.ReactNode
}) {
  return (
    <div className="mt-2">
      <h2>My Organization</h2>
      <div className="mt-5 gap-8 space-y-3 sm:flex md:space-y-0 lg:grid lg:grid-cols-10">
        <div className="lg:col-span-2">
          <SidebarNavigation />
        </div>
        <div className="lg:col-span-8">{children}</div>
      </div>
    </div>
  )
}
