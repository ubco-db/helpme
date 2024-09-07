'use client'

import {
  Button,
  ConfigProvider,
  Divider,
  Form,
  Input,
  List,
  Modal,
  Pagination,
  Popconfirm,
  Progress,
  Select,
  Table,
  Tooltip,
  message,
} from 'antd'
import { ReactElement, useCallback, useEffect, useState } from 'react'
import { useUserInfo } from '@/app/contexts/userContext'
import type { QueueInvite, QueuePartial } from '@koh/common'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { API } from '@/app/api'
import { DeleteOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import Link from 'next/link'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { useCourse } from '@/app/hooks/useCourse'
import QueueInviteListItem from './components/QueueInvite'

interface QueueInvitesPageProps {
  params: { cid: string }
}
export default function QueueInvitesPage({
  params,
}: QueueInvitesPageProps): ReactElement {
  const courseId = Number(params.cid)
  const { userInfo } = useUserInfo()
  const { course } = useCourse(courseId)
  const [queueInvites, setQueueInvites] = useState<QueueInvite[]>([])
  const [isQueueInvitesLoading, setIsQueueInvitesLoading] = useState(true)
  const [selectedQueueId, setSelectedQueueId] = useState<string>('')
  const [selectableQueues, setSelectableQueues] = useState<QueuePartial[]>([])
  const isHttps = window.location.protocol === 'https:'
  const baseURL = `${isHttps ? 'https' : 'http'}://${window.location.host}`

  const fetchQueueInvites = useCallback(async () => {
    try {
      const queueInvites = await API.course.getAllQueueInvites(courseId)
      setQueueInvites(queueInvites)
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      message.error('Failed to load queue invites: ' + errorMessage)
    } finally {
      setIsQueueInvitesLoading(false)
    }
  }, [courseId, setQueueInvites, setIsQueueInvitesLoading])

  useEffect(() => {
    fetchQueueInvites()
  }, [fetchQueueInvites])

  const createQueueInvite = useCallback(async () => {
    const queueId = selectedQueueId
    if (!Number(queueId)) {
      message.error('Invalid queue id: ' + queueId)
      return
    }
    try {
      await API.queueInvites.create(Number(queueId))
      fetchQueueInvites()
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      message.error('Failed to create queue invite: ' + errorMessage)
    }
  }, [fetchQueueInvites, selectedQueueId])

  useEffect(() => {
    // selectableQueues is all course queues minus the ones that already have invites
    if (course && course.queues) {
      const newSelectableQueues = course.queues.filter(
        (queue) =>
          !queueInvites.some((queueInvite) => queueInvite.queueId === queue.id),
      )
      setSelectableQueues(newSelectableQueues)
      if (newSelectableQueues.length === 0) {
        setSelectedQueueId('')
      }
      // if selectedQueueId is not in the new queueInvites, set it to the first newSelectableQueue
      if (
        newSelectableQueues.length > 0 &&
        !newSelectableQueues.some(
          (queue) => queue.id.toString() === selectedQueueId,
        )
      ) {
        setSelectedQueueId(newSelectableQueues[0].id.toString())
      }
    }
  }, [course, queueInvites, selectedQueueId])

  const handleQueueSelectChange = (value: string) => {
    console.log(`selected ${value}`)
    setSelectedQueueId(value)
  }

  if (!course) {
    return <CenteredSpinner tip="Loading course..." />
  } else {
    return (
      <div className="md:mt-3">
        <title>{`HelpMe | Editing ${course.name} Queue Invites`}</title>
        <div className="flex flex-col items-center justify-between md:flex-row">
          <h1>Queue Invites</h1>
          <div className="flex flex-col items-center justify-center gap-2 rounded bg-white p-3 shadow-sm md:flex-row">
            {course.queues && course.queues.length > 0 && (
              <Select
                //defaultValue={}
                placeholder="Select a queue"
                value={
                  selectableQueues.length === 0
                    ? 'All queues have invites'
                    : selectedQueueId !== ''
                      ? selectedQueueId
                      : undefined
                }
                disabled={selectableQueues.length === 0}
                className="w-80"
                onChange={handleQueueSelectChange}
                options={selectableQueues.map((queue) => ({
                  value: queue.id.toString(),
                  label: queue.room,
                }))}
              />
            )}
            <Button
              type="primary"
              disabled={!selectedQueueId}
              onClick={createQueueInvite}
            >
              Create Queue Invite
            </Button>
            <Tooltip title="A queue invite is like a course invite except will take them to the queue page instead of course page. The page for this queue invite will also have a QR code that you can choose to print or display.">
              Help <QuestionCircleOutlined />
            </Tooltip>
          </div>
        </div>
        <Divider className="my-2" />
        <div className="mt-2 rounded bg-white shadow-sm">
          {/* Not sure if I want to display something if none are found */}
          <ConfigProvider
            renderEmpty={() => (
              <div
                className={`mt-10 text-lg text-gray-500 ${course.queues ? 'hidden' : ''}`}
              >
                {!course.queues
                  ? 'There are no queues in this course'
                  : 'No Queue Invites Made Yet'}
              </div>
            )}
          >
            <List
              itemLayout="vertical"
              size="large"
              dataSource={queueInvites}
              loading={isQueueInvitesLoading}
              renderItem={(queueInvite) => (
                <QueueInviteListItem
                  queueInvite={queueInvite}
                  fetchQueueInvites={fetchQueueInvites}
                  baseURL={baseURL}
                />
              )}
            />
          </ConfigProvider>
        </div>
      </div>
    )
  }
}
