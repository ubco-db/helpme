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

  const populateSubscriptions = async () => {
    const response = await fetch(
      `/api/v1/organization/${userInfo.organization?.orgId}/populate_subscription_table`,
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
    <Card>
      <div className="p-6">
        <h2 className="mb-6 text-2xl font-bold text-gray-800">
          Development Tool
        </h2>

        <div className="mb-6">
          <div className="mb-2 flex items-center">
            <Tooltip title="Resets the daily chatbot limit for all users in the organization">
              <span className="mr-2 font-semibold text-gray-700">
                Reset Chat Token Usage Limit
              </span>
              <InfoCircleOutlined className="text-gray-500" />
            </Tooltip>
          </div>
          <Button
            type="primary"
            onClick={resetChatUsageLimit}
            className="transform rounded bg-blue-500 px-4 py-2 font-bold text-white transition duration-300 ease-in-out hover:scale-105 hover:bg-blue-600"
          >
            Reset
          </Button>
        </div>

        <div>
          <span className="mb-2 block font-semibold text-gray-700">
            Populate Chat Token Table
          </span>
          <Button
            type="primary"
            onClick={populateTable}
            className="transform rounded bg-green-500 px-4 py-2 font-bold text-white transition duration-300 ease-in-out hover:scale-105 hover:bg-green-600"
          >
            Populate
          </Button>
        </div>

        <div>
          <span className="mb-2 block font-semibold text-gray-700">
            Populate Subscription Table
          </span>
          <Button
            type="primary"
            onClick={populateSubscriptions}
            className="transform rounded bg-green-500 px-4 py-2 font-bold text-white transition duration-300 ease-in-out hover:scale-105 hover:bg-green-600"
          >
            Populate
          </Button>
        </div>
      </div>
    </Card>
  )
}

export default DevPage
