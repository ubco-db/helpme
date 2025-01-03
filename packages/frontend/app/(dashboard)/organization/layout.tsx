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
      <div className="mt-5 gap-8 space-y-3 md:grid md:grid-cols-10 md:space-y-0">
        <div className="md:col-span-2">
          <SidebarNavigation />
        </div>
        <div className="md:col-span-8">{children}</div>
      </div>
    </div>
  )
}
