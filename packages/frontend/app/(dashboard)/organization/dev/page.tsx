'use client'

import { useUserInfo } from '@/app/contexts/userContext'
import { Button, Card, message } from 'antd'

const DevPage: React.FC = () => {
  const { userInfo } = useUserInfo()

  const populateTable = async () => {
    const response = await fetch(
      `/api/v1/organization/${userInfo.organization?.orgId}/populate_chat_token_table`,
      {
        method: 'POST',
      },
    )

    const json = await response.json()

    if (response.ok) {
      message.success(json.message)
    } else {
      message.error(json.message)
    }
  }

  return (
    <Card title="Development Tool" className="mt-2">
      <div className="flex items-center gap-4">
        <p className="font-bold">Populate Chat Token Table</p>
        <Button type="primary" onClick={populateTable}>
          Populate
        </Button>
      </div>
    </Card>
  )
}

export default DevPage
