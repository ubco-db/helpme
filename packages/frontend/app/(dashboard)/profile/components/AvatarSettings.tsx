'use client'

import { DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import { Col, message, Row, Skeleton, Upload } from 'antd'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import SettingsPanelAvatar from './SettingsPanelAvatar'
import { API } from '@/app/api'

const AvatarSettings: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false)
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 0
  const [avatarSize, setAvatarSize] = useState(windowWidth / 2)
  const [uploading, setUploading] = useState(false)

  const { data: profile, mutate } = useSWR(`api/v1/profile`, async () =>
    API.profile.index(),
  )

  useEffect(() => {
    setIsMobile(windowWidth < 768)
    const widthDivider = isMobile ? 2 : 10
    setAvatarSize(windowWidth / widthDivider)
  }, [windowWidth, isMobile])

  const beforeUpload = (file: any) => {
    const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png'

    if (!isJpgOrPng) {
      message.error('You can only upload JPGs or PNGs!')
    }

    const isLt1M = file.size / 1024 / 1024 < 1
    if (!isLt1M) {
      message.error('Image must smaller than 1MB!')
    }

    return isJpgOrPng && isLt1M
  }

  const handleUpload = async (file: any) => {
    try {
      setUploading(true) // Start the upload state
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('api/v1/profile/upload_picture', {
        method: 'POST',
        body: formData,
      })
      const data = await response.json()
      if (response.ok) {
        message.success(`${file.name} file uploaded successfully`)
        mutate() // Refresh profile data
        window.location.reload()
      } else {
        message.error(`${file.name} file upload failed: ${data.message}`)
      }
    } catch (error) {
      message.error(`Error uploading ${file.name}. Please try again.`)
    } finally {
      setUploading(false) // Reset the upload state regardless of success or error
    }
  }

  return (
    <Col>
      {avatarSize ? (
        <Row className="justify-center">
          {uploading ? (
            <Skeleton.Avatar
              active={true}
              size={avatarSize}
              shape="circle"
              style={{
                marginTop: avatarSize / 6,
                marginBottom: avatarSize / 12,
                marginLeft: avatarSize / 6,
                marginRight: avatarSize / 6,
              }}
            />
          ) : (
            <SettingsPanelAvatar avatarSize={avatarSize} />
          )}
          <Col>
            {profile && (
              <h2>
                {profile.firstName} {profile.lastName ?? ''}
              </h2>
            )}
            <Upload
              customRequest={async ({ file }) => await handleUpload(file)} // Use customRequest to handle the upload logic ourselves
              beforeUpload={beforeUpload}
              showUploadList={false}
              onChange={() => {
                mutate()
              }}
              maxCount={1}
            >
              <button className="mt-4 min-w-[180px] flex-wrap space-x-2 rounded-lg border-2 bg-white p-2">
                <UploadOutlined />
                <span>Edit photo</span>
              </button>
            </Upload>
            {profile?.photoURL && (
              <button
                onClick={async () => {
                  try {
                    await API.profile.deleteProfilePicture()
                    message.success(
                      "You've successfully deleted your profile picture",
                    )
                    mutate()
                    window.location.reload()
                  } catch (e) {
                    message.error(
                      'There was an error with deleting your profile picture, please contact HelpMe Office Hours team for assistance',
                    )
                    throw e
                  }
                }}
                className="mt-2 min-w-[180px] flex-wrap space-x-2 rounded-lg border-2 bg-white p-2"
              >
                <DeleteOutlined />
                <span>Delete Profile Picture</span>
              </button>
            )}
          </Col>
        </Row>
      ) : null}
    </Col>
  )
}

export default AvatarSettings
