'use client'

import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import { ReactElement } from 'react'
import useSWR from 'swr'
import OrganizationUsers from '../components/OrganizationUsers'

const OrganizationUserPage: React.FC = (): ReactElement => {
  const { userInfo } = useUserInfo()

  const { data: organization } = useSWR(
    `organizaton/users`,
    async () => await API.organizations.get(userInfo.organization?.orgId || -1),
  )

  return organization && <OrganizationUsers organization={organization} />
}

export default OrganizationUserPage
