'use client'

import { ReactElement } from 'react'
import { Card } from 'antd'
import OrganizationRoleHistoryList from '@/app/(dashboard)/organization/role_history/components/OrganizationRoleHistoryList'

export default function LMSIntegrationsPage(): ReactElement {
  return (
    <Card
      className={'p-0 md:p-4'}
      title={'Organization Role History'}
      variant="outlined"
    >
      <OrganizationRoleHistoryList />
    </Card>
  )
}
