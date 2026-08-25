'use client'

import { API } from '@/app/api'
import ExpandableText from '@/app/components/ExpandableText'
import { useUserInfo } from '@/app/contexts/userContext'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { formatDateAndTimeForExcel } from '@/app/utils/timeFormatUtils'
import { CronJob } from '@koh/common'
import { Button, Card, message, Table, Tag, Tooltip } from 'antd'
import { useEffect, useState } from 'react'

const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/

const CronJobsPage: React.FC = () => {
  const { userInfo } = useUserInfo()
  const [cronJobs, setCronJobs] = useState<CronJob[] | undefined>(undefined)

  const fetchCronJobs = async () => {
    await API.admin
      .getCronJobs()
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
        <div>
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-gray-700">
            Active Cron Jobs
            <Tooltip title="Calendar Event refers to the 'Schedule' page's Calendar Events. When an event is created with a TA assigned, they will get some cron jobs to auto-checkout at the end of their Calendar Events. I made it robust enough that we can retroactively create them if need be (like if the server were to crash for an extended period of time). Just click this button to do so.">
              <Button
                type="primary"
                onClick={async () => {
                  await API.calendar.adminOnly
                    .resetCronJobs()
                    .then(() => {
                      message.success('Cron jobs reset')
                    })
                    .catch((e) => {
                      const errorMessage = getErrorMessage(e)
                      message.error(
                        'Failed to reset cron jobs: ' + errorMessage,
                      )
                    })
                    .finally(() => {
                      fetchCronJobs()
                    })
                }}
                size="small"
                className="ml-4"
              >
                Reset Calendar Event Cron Jobs
              </Button>
            </Tooltip>
          </h2>
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

export default CronJobsPage
