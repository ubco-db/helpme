'use client'

import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import { getErrorMessage } from '@/app/utils/generalUtils'
import printQRCode from '@/app/utils/QRCodePrintUtils'
import { CopyOutlined, DeleteOutlined, QrcodeOutlined } from '@ant-design/icons'
import {
  GetProfInviteResponse,
  OrganizationCourseResponse,
  OrganizationRole,
} from '@koh/common'
import { Button, Form, Input, List, message } from 'antd'
import { useCallback, useEffect, useState } from 'react'

interface FormValues {
  maxUses: number | null
  expiresAt: Date | null
  makeOrgProf: boolean | null
}

type ProfInvitesProps = {
  courseData: OrganizationCourseResponse
}

const ProfInvites: React.FC<ProfInvitesProps> = ({ courseData }) => {
  const [form] = Form.useForm()
  const { userInfo } = useUserInfo()
  const [profInvites, setProfInvites] = useState<GetProfInviteResponse[]>([])

  const fetchProfInvites = () => {
    if (userInfo.organization?.organizationRole !== OrganizationRole.ADMIN) {
      return // shouldn't be necessary since the component is only rendered if the user is an admin but just in case
    }
    if (courseData.organizationId && courseData.courseId) {
      API.course
        .getAllProfInvites(courseData.organizationId, courseData.courseId)
        .then((profInvites) => {
          setProfInvites(profInvites)
        })
    } else {
      message.error(
        'Error fetching ProfInvites: organizationId or courseId not set',
      )
    }
  }

  useEffect(() => {
    fetchProfInvites()
  }, [])

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
        <div className="flex w-full items-center justify-end space-x-4">
          <Form.Item className="w-1/4"></Form.Item>
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
      <List
        dataSource={profInvites}
        renderItem={(profInvite) => (
          <ProfInviteItem
            key={profInvite.id}
            profInvite={profInvite}
            fetchProfInvites={fetchProfInvites}
          />
        )}
      />
    </div>
  )
}

const ProfInviteItem: React.FC<{
  profInvite: GetProfInviteResponse
  fetchProfInvites: () => void
}> = ({ profInvite, fetchProfInvites }) => {
  const [copyLinkText, setCopyLinkText] = useState('Copy Link')
  const [isDeleteLoading, setIsDeleteLoading] = useState(false)

  const isHttps = window.location.protocol === 'https:'
  const baseURL = `${isHttps ? 'https' : 'http'}://${window.location.host}`
  const inviteURL = `${baseURL}/invite/${profInvite.id}?&c=${profInvite.code}`

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteURL).then(() => {
      setCopyLinkText('Copied!')
      setTimeout(() => {
        setCopyLinkText('Copy Link')
      }, 1000)
    })
  }
  return (
    <List.Item>
      <div>
        {profInvite.code} - {profInvite.expiresAt.toLocaleDateString()}
      </div>
      <div className="mb-4 flex items-center justify-center space-x-2">
        <div>{inviteURL}</div>
        <Button
          onClick={handleCopy}
          type="primary"
          className=""
          icon={<CopyOutlined />}
        >
          {copyLinkText}
        </Button>
      </div>
      <Button
        danger
        onClick={async () => {
          setIsDeleteLoading(true)
          await API.course
            .deleteProfInvite(profInvite.id)
            .then(() => {
              message.success('ProfInvite deleted')
            })
            .catch((error) => {
              message.error(
                'Error deleting ProfInvite: ' + getErrorMessage(error),
              )
            })
            .finally(() => {
              setIsDeleteLoading(false)
              fetchProfInvites()
            })
        }}
        className="h-auto w-full p-3"
        icon={<DeleteOutlined />}
      />
    </List.Item>
  )
}

export default ProfInvites
