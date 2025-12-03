'use client'

import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import printQRCode from '@/app/utils/QRCodePrintUtils'
import {
  CloseOutlined,
  CopyOutlined,
  QrcodeOutlined,
  ReloadOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons'
import { EditCourseInfoParams, OrganizationCourseResponse } from '@koh/common'
import { Button, Popconfirm, message, Divider } from 'antd'
import { useCallback, useState } from 'react'

type CourseInviteCodeProps = {
  courseData: OrganizationCourseResponse
  fetchCourseData: () => void
}

const CourseInviteCode: React.FC<CourseInviteCodeProps> = ({
  courseData,
  fetchCourseData,
}) => {
  const courseCode = courseData.course?.courseInviteCode
  const isEnabled = courseData.course?.isCourseInviteEnabled ?? false
  const [copyLinkText, setCopyLinkText] = useState('Copy Link')

  const updateCourseInvite = useCallback(
    async (params: {
      inviteCode?: string | null
      isEnabled?: boolean
      successMessage: string
    }) => {
      const body: EditCourseInfoParams = {
        courseId: courseData.course?.id,
        courseInviteCode: params.inviteCode,
        isCourseInviteEnabled: params.isEnabled,
      }

      await API.course
        .editCourseInfo(Number(courseData.course?.id), body)
        .then(() => {
          fetchCourseData()
          message.success(params.successMessage)
        })
        .catch((error) => {
          const errorMessage = getErrorMessage(error)
          message.error('Failed to update invite link: ' + errorMessage)
        })
    },
    [courseData.course?.id, fetchCourseData],
  )

  const handleEnableDisable = async () => {
    if (!isEnabled) {
      // Enabling: if no existing code, generate a new one
      if (!courseCode) {
        await updateCourseInvite({
          inviteCode: '',
          isEnabled: true,
          successMessage: 'Invite link enabled and generated',
        })
      } else {
        await updateCourseInvite({
          isEnabled: true,
          successMessage: 'Invite link enabled',
        })
      }
    } else {
      await updateCourseInvite({
        isEnabled: false,
        successMessage: 'Invite link disabled',
      })
    }
  }

  const handleRegenerate = async () => {
    await updateCourseInvite({
      inviteCode: '',
      isEnabled: true,
      successMessage: 'Invite link regenerated',
    })
  }

  const isHttps = window.location.protocol === 'https:'
  const baseURL = `${isHttps ? 'https' : 'http'}://${window.location.host}`
  const inviteURL = `${baseURL}/invite?cid=${courseData.course?.id}&code=${encodeURIComponent(courseCode ?? '')}`

  const handleCopy = () => {
    if (!courseCode || !isEnabled) {
      message.error('Invite link is disabled')
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
    <div className="space-y-3">
      <div className="mb-2 flex flex-col justify-center gap-2 md:flex-row md:items-center">
        {isEnabled ? <div>{inviteURL}</div> : <s>{inviteURL}</s>}
        <div className="flex gap-2">
          <Button
            onClick={handleCopy}
            type="primary"
            disabled={!courseCode || !isEnabled}
            icon={<CopyOutlined />}
          >
            {copyLinkText}
          </Button>
          <Button
            onClick={() =>
              printQRCode(courseData.course?.name ?? '', inviteURL)
            }
            disabled={!courseCode || !isEnabled}
            icon={<QrcodeOutlined />}
          >
            Print QR Code
          </Button>
        </div>
      </div>
      <Divider size="middle" className="mx-auto min-w-2 max-w-40" />
      <div className="flex w-full flex-wrap items-center justify-center gap-2 pt-1">
        <Button
          type={isEnabled ? 'default' : 'primary'}
          onClick={handleEnableDisable}
          className="px-4"
          icon={isEnabled ? <CloseOutlined /> : <UsergroupAddOutlined />}
        >
          {isEnabled ? 'Disable Invite Link' : 'Enable Invite Link'}
        </Button>
        <Popconfirm
          title="Regenerate invite link?"
          description="This will invalidate the current invite link and generate a new one. Students with the old link will no longer be able to join."
          onConfirm={handleRegenerate}
          okText="Yes"
          cancelText="No"
        >
          <Button
            icon={<ReloadOutlined />}
            className="px-4"
            disabled={!isEnabled}
          >
            Regenerate Link
          </Button>
        </Popconfirm>
      </div>
    </div>
  )
}

export default CourseInviteCode
