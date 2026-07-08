'use client'

import { API } from '@/app/api'
import ExpandableText from '@/app/components/ExpandableText'
import { useUserInfo } from '@/app/contexts/userContext'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { formatDateAndTimeForExcel } from '@/app/utils/timeFormatUtils'
import { CronJob } from '@koh/common'
import { Button, Card, Divider, message, Table, Tag } from 'antd'
import { useEffect, useState } from 'react'

const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/

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

  return (
    <Card>
      <div className="p-6">
        <h2 className="mb-6 text-2xl font-bold text-gray-800">
          Development Tools
        </h2>

        <Divider />

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
              pagination={{ pageSize: 20 }}
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
                  render: (cronTime) => {
                    if (dateRegex.test(cronTime)) {
                      return formatDateAndTimeForExcel(cronTime)
                    } else {
                      return cronTime
                    }
                  },
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
                  title: 'Last Execution',
                  dataIndex: 'lastExecution',
                  key: 'lastExecution',
                  render: (lastExecution) =>
                    formatDateAndTimeForExcel(lastExecution),
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
                  render: (nextDates: Date[] | Date) => {
                    return Array.isArray(nextDates) && nextDates.length > 1 ? (
                      <ExpandableText>
                        {nextDates.map((date) => (
                          <p key={date.toString()}>
                            {formatDateAndTimeForExcel(date)}
                          </p>
                        ))}
                      </ExpandableText>
                    ) : Array.isArray(nextDates) ? (
                      formatDateAndTimeForExcel(nextDates[0] || [])
                    ) : (
                      formatDateAndTimeForExcel(nextDates)
                    )
                  },
                  showSorterTooltip: { target: 'full-header' },
                  sorter: (a, b) => {
                    const dateA = formatDateAndTimeForExcel(a.nextDates[0])
                    const dateB = formatDateAndTimeForExcel(b.nextDates[0])
                    return dateA.localeCompare(dateB)
                  },
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
