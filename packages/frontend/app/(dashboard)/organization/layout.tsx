'use client'

import { organizationApi } from '@/app/api/organizationApi'
import { useUserInfo } from '@/app/contexts/userContext'
import { Organization } from '@/app/typings/organization'
import { LayoutProps } from '@/app/typings/types'
import { Spin } from 'antd'
import { useEffect, useState } from 'react'
import SidebarNavigation from './components/SidebarNavigation'

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { userInfo } = useUserInfo()
  const [organization, setOrganization] = useState<Organization>()

  useEffect(() => {
    const fetchDataAsync = async () => {
      const response = await organizationApi.getOrganization(
        Number(userInfo?.organization?.orgId) ?? -1,
      )

      setOrganization(response)
    }

    fetchDataAsync()

    document.title = `Organization Panel`
  }, [organization?.name, userInfo?.organization?.orgId])

  if (!organization) {
    return <Spin />
  }

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

export default Layout
