'use client'

import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { InfoCircleOutlined } from '@ant-design/icons'
import { CronJob } from '@koh/common'
import { Button, Card, message, Table, Tag, Tooltip } from 'antd'
import { useEffect, useState } from 'react'

const DevPage: React.FC = () => {
  const { userInfo } = useUserInfo()
  const [cronJobs, setCronJobs] = useState<CronJob[] | undefined>(undefined)

  const fetchCronJobs = async () => {
    await API.organizations
      .getCronJobs(userInfo.organization?.orgId || 0)
      .then((cronJobs) => {
        setCronJobs(cronJobs)
      })
      .catch((e) => {
        const errorMessage = getErrorMessage(e)
        message.error('Failed to get cron jobs: ' + errorMessage)
      })
  }
  useEffect(() => {
    fetchCronJobs()
  }, [])

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

  console.log(cronJobs)
  return (
    <Card>
      <div className="p-6">
        <h2 className="mb-6 text-2xl font-bold text-gray-800">
          Development Tools
        </h2>

        <div className="mb-6">
          <Tooltip title="Resets the daily chatbot limit for all users in the organization">
            <h3 className="mr-2 font-semibold text-gray-700">
              Reset Chat Token Usage Limit
              <InfoCircleOutlined className="ml-2 text-gray-500" />
            </h3>
          </Tooltip>
          <Button
            type="primary"
            onClick={resetChatUsageLimit}
            className="transform rounded bg-blue-500 px-4 py-2 font-bold text-white transition duration-300 ease-in-out hover:scale-105 hover:bg-blue-600"
          >
            Reset
          </Button>
        </div>

        <div>
          <h3 className="mb-2 block font-semibold text-gray-700">
            Populate Chat Token Table
          </h3>
          <Button
            type="primary"
            onClick={populateTable}
            className="transform rounded bg-green-500 px-4 py-2 font-bold text-white transition duration-300 ease-in-out hover:scale-105 hover:bg-green-600"
          >
            Populate
          </Button>
        </div>

        <div>
          <h3 className="mb-2 block font-semibold text-gray-700">
            Populate Subscription Table
          </h3>
          <Button
            type="primary"
            onClick={populateSubscriptions}
            className="transform rounded bg-green-500 px-4 py-2 font-bold text-white transition duration-300 ease-in-out hover:scale-105 hover:bg-green-600"
          >
            Populate
          </Button>
        </div>

        <div>
          <h3 className="mb-2 block font-semibold text-gray-700">
            Active Cron Jobs
            <Button
              type="primary"
              onClick={async () => {
                await API.calendar
                  .resetCronJobs(userInfo.organization?.orgId || 0)
                  .then(() => {
                    message.success('Cron jobs reset')
                  })
                  .catch((e) => {
                    const errorMessage = getErrorMessage(e)
                    message.error('Failed to reset cron jobs: ' + errorMessage)
                  })
                  .finally(() => {
                    fetchCronJobs()
                  })
              }}
              className="ml-4 transform rounded bg-blue-500 px-4 py-2 font-bold text-white transition duration-300 ease-in-out hover:scale-105 hover:bg-blue-600"
            >
              Reset Calendar Event Cron Jobs
            </Button>
          </h3>
          {cronJobs && (
            <Table<CronJob>
              size="small"
              columns={[
                {
                  title: 'ID',
                  dataIndex: 'id',
                  key: 'id',
                },
                {
                  title: 'cronTime',
                  dataIndex: 'cronTime',
                  key: 'cronTime',
                },
                {
                  title: 'Running',
                  dataIndex: 'running',
                  key: 'running',
                  render: (running) =>
                    running ? (
                      <Tag color="green">Running</Tag>
                    ) : (
                      <Tag color="red">Stopped</Tag>
                    ),
                },
                {
                  title: 'End Date',
                  dataIndex: 'lastDate',
                  key: 'lastDate',
                },
                {
                  title: 'Last Execution',
                  dataIndex: 'lastExecution',
                  key: 'lastExecution',
                },
                {
                  title: 'One-time',
                  dataIndex: 'runOnce',
                  key: 'runOnce',
                  render: (runOnce) => (runOnce ? 'Yes' : ''),
                },
                {
                  title: 'Next Date(s)',
                  dataIndex: 'nextDates',
                  key: 'nextDates',
                  render: (nextDates: Date[]) => (
                    <div>
                      {nextDates.map((date) => (
                        <p key={date.toString()}>{date.toString()}</p>
                      ))}
                    </div>
                  ),
                },
              ]}
              dataSource={cronJobs}
            />
          )}
        </div>
      </div>
    </Card>
  )
}

export default DevPage
