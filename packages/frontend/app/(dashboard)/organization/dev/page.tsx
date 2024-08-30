'use client'

import { useUserInfo } from '@/app/contexts/userContext'
import { InfoCircleOutlined } from '@ant-design/icons'
import { Button, Card, message, Tooltip } from 'antd'

const DevPage: React.FC = () => {
  const { userInfo } = useUserInfo()

  const resetChatUsageLimit = async () => {
    const response = await fetch(
      `/api/v1/organization/${userInfo.organization?.orgId}/reset_chat_token_limit`,
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
        <Tooltip title="Resets the daily chatbot limit for all users in the organization">
          <span className="font-bold">Reset Chat Token Usage Limit</span>{' '}
          <InfoCircleOutlined />
        </Tooltip>
        <Button type="primary" onClick={resetChatUsageLimit}>
          Reset
        </Button>
      </div>
    </Card>
  )
}

export default DevPage
