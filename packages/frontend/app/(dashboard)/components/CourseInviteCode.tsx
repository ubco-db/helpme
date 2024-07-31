'use client'

import { API } from '@/app/api'
import { CopyOutlined } from '@ant-design/icons'
import { OrganizationCourseResponse } from '@koh/common'
import { Button, Form, Input, message } from 'antd'
import { useState } from 'react'

type CourseInviteCodeProps = {
  courseData: OrganizationCourseResponse
  fetchCourseData: () => void
}

const CourseInviteCode: React.FC<CourseInviteCodeProps> = ({
  courseData,
  fetchCourseData,
}) => {
  const [form] = Form.useForm()
  const [courseCode, setCourseCode] = useState(
    courseData.course?.courseInviteCode,
  )

  const submit = async () => {
    const value = await form.validateFields()
    await API.course
      .editCourseInfo(Number(courseData.course?.id), {
        courseId: courseData.course?.id,
        courseInviteCode: value.courseInviteCode,
      })
      .then(() => {
        setCourseCode(value.courseInviteCode)
        fetchCourseData()
        message.success('Edited Course info')
      })
      .catch((error) => {
        message.error(error.response.data.message)
      })
  }

  const handleCopy = () => {
    const isHttps = window.location.protocol === 'https:'
    const baseURL = `${isHttps ? 'https' : 'http'}://${window.location.host}`

    const inviteURL = `${baseURL}/course/${courseData.course?.id}/invite?code=${
      courseCode || ''
    }`

    navigator.clipboard.writeText(inviteURL).then(() => {
      message.success('Invite code copied to clipboard')
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
        onFinish={submit}
      >
        <Form.Item
          className="flex-1"
          label="Invite Code"
          name="courseInviteCode"
          tooltip="This is the code that students will use to join the course."
        >
          <div className="flex space-x-3">
            <Input
              allowClear={true}
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
            />
            <Button
              onClick={handleCopy}
              type="primary"
              className="h-auto p-3"
              disabled={courseCode === null}
            >
              <CopyOutlined />
            </Button>
          </div>
        </Form.Item>
        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            className="h-auto w-full p-3"
          >
            Update Invite Code
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}

export default CourseInviteCode
