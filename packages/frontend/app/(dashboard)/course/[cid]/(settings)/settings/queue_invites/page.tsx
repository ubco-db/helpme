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
import { ReactElement, useCallback, useEffect, useState, use } from 'react'
import type { QueueInvite, QueueInviteParams, QueuePartial } from '@koh/common'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { API } from '@/app/api'
import { QuestionCircleOutlined } from '@ant-design/icons'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import { useCourse } from '@/app/hooks/useCourse'
import QueueInviteListItem from './components/QueueInvite'

interface QueueInvitesPageProps {
  params: Promise<{ cid: string }>
}
export default function QueueInvitesPage(
  props: QueueInvitesPageProps,
): ReactElement {
  const params = use(props.params)
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
      await API.queueInvites.create(Number(queueId)).then((inviteCode) => {
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
            inviteCode: inviteCode,
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
                    { value: 'For Printing', label: 'Office Hours Print' },
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
              classNames={{
                root: 'max-w-96',
              }}
              title={
                <div className="flex flex-col gap-y-2">
                  <p>
                    A queue invite works the same as a course invite except it
                    gives students a preview of how busy the queue is before
                    needing to login.
                  </p>
                  <p>
                    See video for motivation behind this:
                    <div className="youtube-video-container">
                      <iframe
                        src="https://www.youtube.com/embed/H9ywkvDdeZ0?si=MFrDY7aZYXfDPNeK&amp;start=294"
                        title="YouTube video player"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                      />
                    </div>
                  </p>
                  <div>
                    As a professor, there are 3 primary ways you could use this
                    feature:
                    <ul className="list-inside list-disc">
                      <li>
                        Standard: Create invite, copy and share link with
                        students
                      </li>
                      <li>
                        Hybrid Office Hours/Help Desk: Create invite, print QR
                        code, and stick it outside your office/room
                      </li>
                      <li>
                        Projector (e.g. for in a busy lab): Create invite,{' '}
                        <i>professor clicks on invite link</i> and puts it up on
                        the projector screen,{' '}
                        <i>
                          professor clicks &quot;Show QR Code&quot; at bottom of
                          screen
                        </i>
                        . Compared to just printing the QR code, this will allow
                        everyone in the room to see the status of the queue just
                        by looking at the projector.
                      </li>
                    </ul>
                  </div>
                  <p>
                    Note that you may want to enable &quot;Will Invite to
                    Course&quot; initially until your students have all joined
                    your HelpMe course. But if you leave this setting enabled
                    and have the invite posted/printed somewhere publicly,
                    anyone would be able to join your HelpMe course!
                  </p>
                </div>
              }
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
                  courseName={course.name}
                  isCourseInviteCodeSet={course.courseInviteCode !== null}
                />
              )}
            />
          </ConfigProvider>
        </div>
      </div>
    )
  }
}
