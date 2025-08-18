'use client'

import { useUserInfo } from '@/app/contexts/userContext'
import { useState } from 'react'
import { Table } from 'antd'
import { LtiConfig } from '@koh/common'

const AdminPage: React.FC = () => {
  const [ltiConfigs, setLtiConfigs] = useState<LtiConfig>()
  const userInfo = useUserInfo()

  return (
    <Table>
      <Table.Column dataIndex={'url'} title={'LTI URL'} />
      <Table.Column dataIndex={'iss'} title={'Platform (ISS)'} />
      <Table.Column dataIndex={'name'} title={'Name'} />
    </Table>
  )
}
