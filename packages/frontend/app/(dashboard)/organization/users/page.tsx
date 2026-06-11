'use client'

import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import { ReactElement, ReactNode } from 'react'
import useSWR from 'swr'
import OrganizationUsers from '../components/OrganizationUsers'

const OrganizationUserPage: React.FC = (): ReactNode => {
  const { userInfo } = useUserInfo()

  const { data: organization } = useSWR(
    `organization/users`,
    async () => await API.organizations.get(userInfo.organization?.orgId || -1),
  )

  return (
    organization != undefined && (
      <OrganizationUsers organization={organization} />
    )
  )
}

export default OrganizationUserPage
