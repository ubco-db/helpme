'use client'

import {
  EditOutlined,
  NotificationOutlined,
  StopOutlined,
} from '@ant-design/icons'
import { Button, Card, Divider, Input, message, Row, Tag, Tooltip } from 'antd'
import Link from 'next/link'
import { ReactElement, useState } from 'react'
import UserAvatar from '@/app/components/UserAvatar'
import { QueuePartial } from '@koh/common'
import { getQueueTypeLabel } from '../queue/[qid]/utils/commonQueueFunctions'
import { useCourse } from '@/app/hooks/useCourse'
import { API } from '@/app/api'
import { cn, getErrorMessage } from '@/app/utils/generalUtils'

interface QueueCardProps {
  cid: number
  queue: QueuePartial
  isStaff: boolean
  linkId: string
}

const QueueCard: React.FC<QueueCardProps> = ({
  cid,
  queue,
  isStaff,
  linkId,
}): ReactElement => {
  const { mutateCourse } = useCourse(cid)
  const [editingNotes, setEditingNotes] = useState(false)
  const [updatedNotes, setUpdatedNotes] = useState(queue.notes)
  const [isLinkEnabled, setIsLinkEnabled] = useState(true) // for enabling/disabling the link to the queue when editing notes

  const getQueueTypeColor = (type: string) => {
    switch (type) {
      case 'inPerson':
        return '#097969'
      case 'hybrid':
        return '#06808E'
      case 'online':
        return '#0488B4'
      default:
        return '#008080' // just in case, this default will match the color of hybrid
    }
  }

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
      })
      .catch((e) => {
        const errorMessage = getErrorMessage(e)
        message.error(`Error updating queue notes: ${errorMessage}`)
      })
  }
  return (
    <Link
      href={isLinkEnabled ? `/course/${cid}/queue/${queue.id}` : ''}
      aria-label={
        queue.room +
        ' Queue' +
        (queue.staffList.length >= 1 ? '. It has staff checked in.' : '')
      }
      id={linkId}
    >
      <Card
        classNames={{
          header: cn(
            'text-white rounded-t-lg',
            queue.isOpen ? 'bg-[#25426C]' : 'bg-[#1e3659]',
          ),
          body: 'pt-4',
        }}
        // make the card glow if there are staff members in the queue
        className={cn(
          'my-4 rounded-md',
          queue.staffList.length >= 1 ? 'glowy' : '',
          isLinkEnabled ? 'cursor-pointer' : '',
          'queueCard',
        )}
        title={
          <span className="mr-8 flex flex-row flex-wrap items-center justify-between">
            <div>
              {queue.room}
              <div className="mb-1 flex flex-wrap gap-y-1 sm:mb-0">
                {queue?.type && (
                  <Tag
                    color={getQueueTypeColor(queue.type)}
                    className="m-0 mr-1 leading-4 text-gray-200"
                  >
                    {getQueueTypeLabel(queue.type)}
                  </Tag>
                )}
                {queue?.isProfessorQueue && (
                  <Tag
                    color="#337589"
                    className="m-0 mr-1 leading-4 text-gray-200"
                  >
                    Professor Queue
                  </Tag>
                )}
                {queue.isOpen && !queue.allowQuestions && (
                  <Tooltip title="This queue is not accepting questions right now">
                    <Tag
                      icon={<StopOutlined />}
                      color="#591e40"
                      className="m-0 leading-4 text-gray-300"
                    >
                      Not Accepting Questions
                    </Tag>
                  </Tooltip>
                )}
              </div>
            </div>
          </span>
        }
        extra={
          <div className="mr-8 h-fit text-sm font-normal text-gray-200">
            <span className="text-lg font-medium">{queue.queueSize}</span> in
            queue
          </div>
        }
      >
        <div className="flex flex-row items-center justify-start">
          <div className=" mr-3 text-sm">
            <span className=" text-base">{queue.staffList.length} </span>
            staff checked in{queue.staffList.length > 0 ? ':' : ''}
          </div>
          <div>
            {queue.staffList.map((staffMember) => (
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
          <Divider className="mb-0 mt-3" />
          {/* If notes being edited, show input box.
            Else if there are notes, show the notes.
            Else if you're a TA, show placeholder.
            Else show nothing */}
          {editingNotes ? (
            <div className="mr-2.5 mt-2.5 flex flex-grow flex-row">
              <Input.TextArea
                className="my-auto ml-2.5 rounded-md border border-[#b8c4ce]"
                defaultValue={queue.notes}
                value={updatedNotes}
                onChange={(e) => setUpdatedNotes(e.target.value as any)}
              />
            </div>
          ) : queue.notes ? (
            <div className="whitespace-pre-wrap break-words text-[rgb(125,125,125)]">
              <NotificationOutlined /> <i>{queue.notes}</i>
            </div>
          ) : isStaff ? (
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
              <Row className="pt-2.5">
                {isStaff && (
                  <Button
                    className="rounded-md border px-4 py-2 text-base font-medium"
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
