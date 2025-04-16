import { API } from '@/app/api'
import { userApi } from '@/app/api/userApi'
import { useUserInfo } from '@/app/contexts/userContext'
import { getErrorMessage } from '@/app/utils/generalUtils'
import {
  DeleteOutlined,
  QuestionCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { Button, Card, message, Tooltip } from 'antd'
import { useState } from 'react'

const AdvancedSettings: React.FC = () => {
  const { userInfo, setUserInfo } = useUserInfo()
  const [isLoading, setIsLoading] = useState(false)

  return (
    userInfo && (
      <Card
        title={
          <h2>
            <SettingOutlined /> Advanced Settings
          </h2>
        }
        bordered
        classNames={{ body: 'py-2' }}
      >
        <Tooltip
          title={`Notice some weird behavior where the server is giving you errors but the client looks fine on your end? The profile caching may have become unsynced. Click this button to clear the cache (there are no consequences of doing so).`}
        >
          Clear Profile Cache
          <QuestionCircleOutlined className="ml-0.5 text-gray-500" />
        </Tooltip>
        <Button
          icon={<DeleteOutlined />}
          loading={isLoading}
          onClick={async () => {
            setIsLoading(true)
            await API.profile
              .clearCache()
              .then(async () => {
                await userApi
                  .getUser()
                  .then((userDetails) => {
                    setUserInfo(userDetails)
                    message.success('Profile cache cleared successfully')
                  })
                  .catch((error) => {
                    message.error(
                      'Cache cleared but error getting new user details: ' +
                        getErrorMessage(error),
                    )
                  })
              })
              .catch((error) => {
                message.error(
                  'Error clearing profile cache: ' + getErrorMessage(error),
                )
              })
            setIsLoading(false)
          }}
          className="ml-2"
        >
          Clear
        </Button>
      </Card>
    )
  )
}

export default AdvancedSettings
