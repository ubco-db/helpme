'use client'

import {
  EditOutlined,
  NotificationOutlined,
  RightOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { Button, Card, Divider, Input, message, Row, Tag, Tooltip } from 'antd'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { ReactElement, useState } from 'react'
import styles from './QueueCard.module.css'
import UserAvatar from '@/app/components/UserAvatar'
import { QueuePartial } from '@koh/common'
import { LinkIt } from 'react-linkify-it'
import { useCourse } from '@/app/hooks/useCourse'
import { API } from '@/app/api'

type QueueCardProps = {
  queue: QueuePartial
  isTA: boolean
  linkId?: string
}

const QueueCard = ({ queue, isTA, linkId }: QueueCardProps): ReactElement => {
  const router = useRouter()
  const { cid } = router.query
  const { mutateCourse } = useCourse(Number(cid))
  const [editingNotes, setEditingNotes] = useState(false)
  const [updatedNotes, setUpdatedNotes] = useState(queue.notes)
  const [isLinkEnabled, setIsLinkEnabled] = useState(true) // for enabling/disabling the link to the queue when editing notes

  const staffList = queue.staffList

  const handleSaveQueueNotes = async (e: { preventDefault: () => void }) => {
    e.preventDefault()
    setIsLinkEnabled(true)
    setEditingNotes(false)
    // update the queue notes
    await API.queues
      .update(queue.id, {
        notes: updatedNotes,
        allowQuestions: queue.allowQuestions,
      })
      .then(() => {
        mutateCourse()
        message.success('Queue notes updated successfully')
        return
      })
      .catch((e) => {
        const errorMessage = e?.response?.data?.message ?? e.message
        message.error(`Error updating queue notes: ${errorMessage}`)
      })
  }
  return (
    <Link
      href={isLinkEnabled ? `/course/${cid}/queue/${queue.id}` : ''}
      aria-label={
        queue.room +
        ' Queue ' +
        (queue.staffList.length >= 1 ? '. It has staff checked in. ' : '')
      }
      id={linkId}
    >
      <Card
        headStyle={{
          background: queue.isOpen ? '#25426C' : '#25426cbf',
          color: '#FFFFFF',
          borderRadius: '6px 6px 0 0',
        }}
        // make the card glow if there are staff members in the queue
        className={
          styles.queuecard +
          ' open-queue-card ' +
          (queue.staffList.length >= 1 ? ' glowy ' : '') +
          (isLinkEnabled ? ' cursor-pointer ' : '')
        }
        title={
          <span className="mr-8 flex flex-row flex-wrap items-center justify-between">
            <div>
              {queue.room}
              <div className="flex">
                {queue?.isProfessorQueue && (
                  <Tag color="#337589" className="m-0 mr-1 text-gray-200">
                    Professor Queue
                  </Tag>
                )}
                {queue.isOpen && !queue.allowQuestions && (
                  <Tooltip title="This queue is no longer accepting questions">
                    <Tag
                      icon={<StopOutlined />}
                      color="#591e40"
                      className="m-0 text-gray-300"
                    >
                      Not Accepting Questions
                    </Tag>
                  </Tooltip>
                )}
              </div>
            </div>
            <div className="mr-8 h-fit text-sm font-normal text-gray-200">
              <span className="text-lg font-medium">{queue.queueSize}</span> in
              queue
            </div>
          </span>
        }
        extra={<RightOutlined className=" text-3xl text-gray-100" />}
      >
        <div className="flex flex-row items-center justify-start">
          <div className=" mr-3 text-sm">
            <span className=" text-base">{queue.staffList.length} </span>
            staff checked in{queue.staffList.length > 0 ? ':' : ''}
          </div>
          <div>
            {staffList.map((staffMember) => (
              <Tooltip key={staffMember.id} title={staffMember.name}>
                <UserAvatar
                  className="mr-4"
                  size={48}
                  photoURL={staffMember.photoURL}
                  username={staffMember.name}
                />
              </Tooltip>
            ))}
          </div>
        </div>

        <Row justify="space-between" align="middle">
          <Divider className="my-12 mb-0 mt-12" />
          {/* If notes being edited, show input box.
            Else if there are notes, show the notes.
            Else if you're a TA, show placeholder.
            Else show nothing */}
          {editingNotes ? (
            <div className="m-10 mr-0 mt-10 flex flex-grow flex-row">
              <Input.TextArea
                className="m-auto ml-10 rounded-md border border-[#b8c4ce]"
                defaultValue={queue.notes}
                value={updatedNotes}
                onChange={(e) => setUpdatedNotes(e.target.value as any)}
              />
            </div>
          ) : queue.notes ? (
            <div>
              <div className="whitespace-pre-wrap break-words text-[rgb(125,125,125)]">
                {/* This LinkIt will automatically replace any links in the queue notes with actual links that users can click */}
                <NotificationOutlined />{' '}
                <i>
                  <LinkIt
                    component={(url, key) => (
                      <a
                        href={/^www\./.exec(url) ? `http://${url}` : url}
                        target="_blank"
                        rel="noopener noreferrer"
                        key={key}
                      >
                        {url}
                      </a>
                    )}
                    regex={
                      /(https?:\/\/|www\.)([-\w.]+\/[\p{L}\p{Emoji}\p{Emoji_Component}!#$%&'"()*+,./\\:;=_?@[\]~-]*[^\s'",.;:\b)\]}?]|(([\w-]+\.)+[\w-]+[\w/-]))/u
                    }
                  >
                    {queue.notes}
                  </LinkIt>
                </i>
              </div>
            </div>
          ) : isTA ? (
            <i className="font-light text-gray-400"> no notes provided </i>
          ) : null}
          <div className="flex">
            {editingNotes && (
              <Button
                onClick={handleSaveQueueNotes}
                size="large"
                className="rounded-md bg-[#2a9187] px-4 py-2 text-base font-medium text-white"
              >
                Save Changes
              </Button>
            )}
            {!editingNotes && (
              <Row className="pt-10">
                {isTA && (
                  <Button
                    className="rounded-md border border-transparent px-4 py-2 text-base font-medium"
                    onClick={(e) => {
                      e.preventDefault()
                      setIsLinkEnabled(false)
                      setEditingNotes(true)
                    }}
                    icon={<EditOutlined />}
                  />
                )}
              </Row>
            )}
          </div>
        </Row>
      </Card>
    </Link>
  )
}

export default QueueCard
