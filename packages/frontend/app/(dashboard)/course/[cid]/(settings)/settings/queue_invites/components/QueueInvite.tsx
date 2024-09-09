'use client'

import {
  Button,
  Checkbox,
  Form,
  Input,
  List,
  Popconfirm,
  Select,
  message,
} from 'antd'
import type { QueueInvite, QueueInviteParams } from '@koh/common'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { API } from '@/app/api'
import { CopyOutlined, DeleteOutlined } from '@ant-design/icons'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import _ from 'lodash'

interface QueueInviteProps {
  queueInvite: QueueInvite
  fetchQueueInvites: () => void
  baseURL: string
}
const QueueInviteListItem: React.FC<QueueInviteProps> = ({
  queueInvite,
  fetchQueueInvites,
  baseURL,
}) => {
  const [form] = Form.useForm()
  const [copyLinkText, setCopyLinkText] = useState('Copy Link')
  const [hasValuesChanged, setHasValuesChanged] = useState(false)
  const [isSaveLoading, setIsSaveLoading] = useState(false)
  const inviteURL = `${baseURL}/qi/${queueInvite.queueId}?c=${encodeURIComponent(queueInvite.inviteCode)}`
  const handleCopy = () => {
    navigator.clipboard.writeText(inviteURL).then(() => {
      setCopyLinkText('Copied!')
      setTimeout(() => {
        setCopyLinkText('Copy Link')
      }, 1000)
    })
  }

  // refresh the form when the queueInvite changes (this is needed because the form is not re-rendered when a queueInvite is deleted/created, which will move the form values to another listitem)
  useEffect(() => {
    form.setFieldsValue(queueInvite)
    setHasValuesChanged(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, queueInvite.queueId])

  const onFinish = (values: QueueInviteParams) => {
    setIsSaveLoading(true)
    API.queueInvites
      .update(queueInvite.queueId, values)
      .then(() => {
        fetchQueueInvites()
        message.success(`Updated ${queueInvite.room}'s queue invite`)
        setHasValuesChanged(false)
      })
      .catch((error) => {
        const errorMessage = getErrorMessage(error)
        message.error('Failed to update queue invite: ' + errorMessage)
      })
      .finally(() => {
        setIsSaveLoading(false)
      })
  }

  return (
    <List.Item key={queueInvite.queueId}>
      <List.Item.Meta
        title={<span className="text-lg font-bold">{queueInvite.room}</span>}
        description={
          queueInvite.inviteCode === '' ? (
            'No invite code set. No students can join this yet'
          ) : (
            <div className="flex items-center gap-2">
              <Link
                target="_blank" // open in new tab
                href={`/qi/${queueInvite.queueId}?c=${encodeURIComponent(queueInvite.inviteCode)}`}
              >
                {inviteURL}
              </Link>
              <Button
                type="default"
                icon={<CopyOutlined />}
                onClick={handleCopy}
              >
                {copyLinkText}
              </Button>
            </div>
          )
        }
      />
      <div className="flex justify-between">
        <div className="flex gap-2">
          <Form
            form={form}
            layout="inline"
            initialValues={queueInvite}
            onValuesChange={(changedValues, allValues) => {
              const allFormValuesWithExtraQueueInviteStuff = {
                ...queueInvite,
                ...allValues,
              }
              // do a deep comparison to see if the form has changed (note: i tried using JSON.stringfiy, but the order of the attributes were changed so that didn't work. I also don't want to manually compare each attribute since it's less maintainable that way)
              if (
                _.isEqual(allFormValuesWithExtraQueueInviteStuff, queueInvite)
              ) {
                setHasValuesChanged(false)
              } else {
                setHasValuesChanged(true)
              }
            }}
            onFinish={onFinish}
          >
            <Form.Item hidden name="queueId">
              <Input />
            </Form.Item>
            <Form.Item
              label="Invite Code"
              tooltip="This is the code that added onto the link to prevent just anyone from joining the queue. You can set it to anything you like, though preferably not something easy to guess. Once set, you can share the invite link to your students."
              name="inviteCode"
              rules={[{ min: 8, message: 'Code is minimum 8 characters' }]}
            >
              <Input allowClear />
            </Form.Item>
            <Form.Item
              label="QR Code"
              tooltip="This will show a QR code on the queue invite page that can then be printed or displayed on a projector to allow students to join."
              name="QRCodeEnabled"
              valuePropName="checked"
            >
              <Checkbox />
            </Form.Item>

            <Form.Item
              label="QR Error Level"
              tooltip={{
                title: (
                  <div className="flex flex-col gap-y-2">
                    <p>The error level of the QR code.</p>
                    <p>
                      L: smaller QR code (default). Better for
                      projectors/screens
                    </p>
                    <p>
                      M: will keep working even if obscured but will be bigger.
                      Better for printing (e.g. having QR code on piece of paper
                      outside your office door for office hours)
                    </p>
                  </div>
                ),
                overlayStyle: { maxWidth: '25rem' },
              }}
              name="QRCodeErrorLevel"
            >
              <Select
                size="small"
                options={[
                  { value: 'L', label: 'L' },
                  { value: 'M', label: 'M' },
                ]}
              />
            </Form.Item>
            <Form.Item
              label="Show Questions"
              tooltip="This will show the questions on the queue invite page. You can then display this on a projector to essentially have a queue page with a QR code that students can use to join."
              name="isQuestionsVisible"
              valuePropName="checked"
            >
              <Checkbox />
            </Form.Item>
            <Form.Item
              label="Will Invite to Course"
              tooltip={{
                title: (
                  <div className="flex flex-col gap-y-2">
                    <p>
                      Enabling this will allow users who are <i>not</i> in your
                      course to use this link (normally they can still click on
                      the link, but they can&apos;t use it to join the
                      course/queue unless they are already in the course).{' '}
                    </p>
                    <p>
                      Generally, you may want this enabled until all of your
                      students are in the course or if you just want anyone to
                      be able to join your course.
                    </p>
                    <p>
                      Also, be sure to set a course invite code in General
                      Settings otherwise this will not work!
                    </p>
                  </div>
                ),
                overlayStyle: { maxWidth: '22rem' },
              }}
              name="willInviteToCourse"
              valuePropName="checked"
            >
              <Checkbox />
            </Form.Item>
            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                disabled={!hasValuesChanged}
                loading={isSaveLoading}
              >
                Save
              </Button>
            </Form.Item>
          </Form>
        </div>
        <Popconfirm
          title="Are you sure you want to delete this queue invite?"
          onConfirm={async () => {
            try {
              await API.queueInvites.delete(queueInvite.queueId)
              fetchQueueInvites()
            } catch (error) {
              const errorMessage = getErrorMessage(error)
              message.error('Failed to delete queue invite: ' + errorMessage)
            }
          }}
          okText="Yes"
          cancelText="No"
        >
          <Button className="min-w-8" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </div>
    </List.Item>
  )
}

export default QueueInviteListItem
