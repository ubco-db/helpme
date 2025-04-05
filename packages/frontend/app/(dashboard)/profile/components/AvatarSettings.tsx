'use client'

import { DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { Col, message, Popconfirm, Row, Skeleton } from 'antd'
import ImageCropperModal from '../../components/ImageCropperModal'
import { useEffect, useState } from 'react'
import { API } from '@/app/api'
import UserAvatar from '@/app/components/UserAvatar'
import { useMediaQuery } from '@/app/hooks/useMediaQuery'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { useUserInfo } from '@/app/contexts/userContext'

const AvatarSettings: React.FC = () => {
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 0
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [avatarSize, setAvatarSize] = useState(windowWidth / 2)
  const [uploading, setUploading] = useState(false)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const { userInfo, setUserInfo } = useUserInfo()

  useEffect(() => {
    const widthDivider = isMobile ? 3 : 10
    setAvatarSize(windowWidth / widthDivider)
  }, [windowWidth, isMobile])

  return (
    <Col>
      {avatarSize ? (
        <Row className="justify-evenly md:justify-center">
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
            <UserAvatar
              photoURL={userInfo?.photoURL}
              username={userInfo?.name}
              size={avatarSize}
            />
          )}
          <Col>
            {userInfo && (
              <h2>
                {userInfo.firstName} {userInfo.lastName ?? ''}
              </h2>
            )}
            <ImageCropperModal
              isOpen={isUploadModalOpen}
              circular={true}
              aspect={1}
              imgName="Avatar"
              postURL="api/v1/profile/upload_picture"
              onUpdateComplete={(photoURL) => {
                // Update the context
                setUserInfo({
                  ...userInfo,
                  photoURL: photoURL ? photoURL : userInfo.photoURL,
                })
              }}
              setUploading={setUploading}
              onCancel={() => setIsUploadModalOpen(false)}
            />
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="mt-4 min-w-[180px] flex-wrap space-x-2 rounded-lg border-2 bg-white p-2"
            >
              <EditOutlined />
              <span>Edit Avatar</span>
            </button>
            {userInfo?.photoURL && (
              <Popconfirm
                title="Are you sure you want to delete your profile avatar?"
                getPopupContainer={(trigger) =>
                  trigger.parentNode as HTMLElement
                }
                onConfirm={async () => {
                  await API.profile
                    .deleteProfilePicture()
                    .then(() => {
                      message.success(
                        "You've successfully deleted your profile avatar",
                      )
                      setUserInfo({ ...userInfo, photoURL: '' })
                    })
                    .catch((e) => {
                      const errorMessage = getErrorMessage(e)
                      message.error(
                        'Failed to delete profile avatar:',
                        errorMessage,
                      )
                    })
                }}
                okText="Yes"
                cancelText="No"
              >
                <button className="mt-2 min-w-[180px] flex-wrap space-x-2 rounded-lg border-2 bg-white p-2">
                  <DeleteOutlined />
                  <span>Delete Avatar</span>
                </button>
              </Popconfirm>
            )}
          </Col>
        </Row>
      ) : null}
    </Col>
  )
}

export default AvatarSettings
