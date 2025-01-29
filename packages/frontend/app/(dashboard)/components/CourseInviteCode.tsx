'use client'

import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import printQRCode from '@/app/utils/QRCodePrintUtils'
import { CopyOutlined, QrcodeOutlined } from '@ant-design/icons'
import { OrganizationCourseResponse } from '@koh/common'
import { Button, Form, Input, message } from 'antd'
import { useCallback, useState } from 'react'

interface FormValues {
  courseInviteCode: string | null
}

type CourseInviteCodeProps = {
  courseData: OrganizationCourseResponse
  fetchCourseData: () => void
}

const CourseInviteCode: React.FC<CourseInviteCodeProps> = ({
  courseData,
  fetchCourseData,
}) => {
  const [form] = Form.useForm()
  const courseCode = courseData.course?.courseInviteCode
  const [copyLinkText, setCopyLinkText] = useState('Copy Link')

  const updateCourseCode = useCallback(
    async (inviteCode: string | null) => {
      await API.course
        .editCourseInfo(Number(courseData.course?.id), {
          courseId: courseData.course?.id,
          courseInviteCode: inviteCode,
        })
        .then(() => {
          fetchCourseData()
          form.setFieldsValue({ courseInviteCode: inviteCode })
          message.success('Updated invite code')
        })
        .catch((error) => {
          const errorMessage = getErrorMessage(error)
          message.error('Failed to update invite code:' + errorMessage)
        })
    },
    [courseData.course?.courseInviteCode],
  )

  const submit = async (values: FormValues) => {
    updateCourseCode(values.courseInviteCode)
  }

  const isHttps = window.location.protocol === 'https:'
  const baseURL = `${isHttps ? 'https' : 'http'}://${window.location.host}`
  const inviteURL =
    courseCode === null || courseCode === undefined
      ? 'No invite code set. No students can join the course'
      : `${baseURL}/invite?cid=${courseData.course?.id}&code=${encodeURIComponent(courseCode)}`

  const handleCopy = () => {
    if (courseCode === null) {
      message.error('No invite code set')
      return
    }
    navigator.clipboard.writeText(inviteURL).then(() => {
      setCopyLinkText('Copied!')
      setTimeout(() => {
        setCopyLinkText('Copy Link')
      }, 1000)
    })
  }

  return (
    <div>
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          courseInviteCode: courseCode,
        }}
        onFinish={(values) => submit(values)}
      >
        <Form.Item
          className="flex-1"
          label="Invite Code"
          name="courseInviteCode"
          rules={[
            {
              pattern: /^[a-zA-Z0-9_-]+$/,
              message:
                'Only letters, numbers, hyphen, and underscore allowed (restriction will be fixed and removed later)',
            },
          ]}
          tooltip="The invite code gets added onto the invite link and is there to prevent anyone without the code from joining the course. You can set it to anything you like, though preferably not something easy to guess. Once set, you can share the invite link to your students. "
        >
          <Input allowClear={true} />
        </Form.Item>
        <div className="mb-4 flex items-center justify-center space-x-2">
          <div>{inviteURL}</div>
          <Button
            onClick={handleCopy}
            type="primary"
            className=""
            disabled={courseCode === null}
            icon={<CopyOutlined />}
          >
            {copyLinkText}
          </Button>
          <Button
            onClick={() =>
              printQRCode(courseData.course?.name ?? '', inviteURL)
            }
            type="default"
            disabled={courseCode === null}
            icon={<QrcodeOutlined />}
          >
            Print QR Code
          </Button>
        </div>
        <div className="flex w-full items-center justify-end space-x-4">
          <Form.Item className="w-1/4">
            <Button
              danger
              onClick={async () => {
                await updateCourseCode(null)
              }}
              className="h-auto w-full p-3"
            >
              Clear Invite Code
            </Button>
          </Form.Item>
          <Form.Item className="w-3/4">
            <Button
              type="primary"
              htmlType="submit"
              className="h-auto w-full p-3"
            >
              Update Invite Code
            </Button>
          </Form.Item>
        </div>
      </Form>
    </div>
  )
}

export default CourseInviteCode
