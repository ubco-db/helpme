'use client'

import {
  Button,
  ConfigProvider,
  Divider,
  List,
  Select,
  Tooltip,
  message,
} from 'antd'
import { ReactElement, useCallback, useEffect, useState } from 'react'
import type { QueueInvite, QueueInviteParams, QueuePartial } from '@koh/common'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { API } from '@/app/api'
import { QuestionCircleOutlined } from '@ant-design/icons'
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
  const { course } = useCourse(courseId)
  const [queueInvites, setQueueInvites] = useState<QueueInvite[]>([])
  const [isQueueInvitesLoading, setIsQueueInvitesLoading] = useState(true)
  const [selectedPreset, setSelectedPreset] = useState<
    'Default' | 'For Printing' | 'Projector' | 'Help Desk Print'
  >()
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
      await API.queueInvites.create(Number(queueId)).then(() => {
        if (
          selectedPreset === 'For Printing' ||
          selectedPreset === 'Projector' ||
          selectedPreset === 'Help Desk Print'
        ) {
          const queueInvitePreset: QueueInviteParams = {
            queueId: Number(queueId),
            QRCodeEnabled: true,
            isQuestionsVisible: selectedPreset === 'Projector' ? true : false,
            willInviteToCourse:
              selectedPreset === 'Help Desk Print' ? true : false,
            inviteCode: '',
            QRCodeErrorLevel:
              selectedPreset === 'For Printing' ||
              selectedPreset === 'Help Desk Print'
                ? 'M'
                : 'L',
          }
          API.queueInvites
            .update(Number(queueId), queueInvitePreset)
            .then(() => {
              fetchQueueInvites()
            })
        } else {
          fetchQueueInvites()
        }
      })
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      message.error('Failed to create queue invite: ' + errorMessage)
    }
  }, [fetchQueueInvites, selectedPreset, selectedQueueId])

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
              <>
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
                  onChange={(value) => setSelectedQueueId(value)}
                  options={selectableQueues.map((queue) => ({
                    value: queue.id.toString(),
                    label: queue.room,
                  }))}
                />
                {/* The presets are not just there to help quickly set up queue invites, it's actually there more to give profs IDEAS on how they are expected to use this feature */}
                <Select
                  placeholder="Preset"
                  value={selectedPreset}
                  className="w-36"
                  onChange={(value) => setSelectedPreset(value)}
                  options={[
                    { value: 'Default', label: 'Default Preset' },
                    { value: 'For Printing', label: 'For Printing' },
                    { value: 'Projector', label: 'Projector' },
                    { value: 'Help Desk Print', label: 'Help Desk Print' },
                  ]}
                />
              </>
            )}
            <Button
              type="primary"
              disabled={!selectedQueueId}
              onClick={createQueueInvite}
            >
              Create Queue Invite
            </Button>
            <Tooltip
              title={
                <div className="flex flex-col gap-y-2">
                  <p>
                    A queue invite is like a course invite except will take them
                    to the queue page instead of course page. The page for this
                    queue invite will also have a QR code that you can choose to
                    print or display, as well as some other features.
                  </p>
                  <p>
                    Anyone will be able to join the queue if they have the
                    invite code/link/QRCode.
                  </p>
                  <p>
                    NOTE: When someone first accesses the page, the QR code and
                    some other details are hidden. You must toggle the switch on
                    the bottom of the page to show the QR code (this is because
                    when someone clicks the link or scans the QR code, the first
                    thing they would see is the QR code they just scanned, which
                    is confusing to students)
                  </p>
                  <p>You can also click on the QR code to print it.</p>
                </div>
              }
              overlayStyle={{ maxWidth: '25rem' }}
            >
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
                className={`mt-10 text-lg text-gray-500 ${!course.queues || course.queues.length === 0 ? '' : 'hidden'}`}
              >
                {!course.queues || course.queues.length === 0
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
