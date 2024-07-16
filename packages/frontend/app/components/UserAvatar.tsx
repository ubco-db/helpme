import { UserOutlined } from '@ant-design/icons'
import { Avatar, AvatarProps } from 'antd'
import React, { ReactElement } from 'react'
import { useUserInfo } from '../contexts/userContext'
import { getInitialsFromName, nameToRGB } from '../utils/generalUtils'

type SelfAvatarProps = Omit<AvatarProps, 'icon' | 'src'>
type UserAvatarProps = Omit<AvatarProps, 'icon' | 'src'> & {
  photoURL: string | undefined
  username: string | undefined
}

export function SelfAvatar({ ...props }: SelfAvatarProps): ReactElement {
  const { userInfo } = useUserInfo()

  return (
    <UserAvatar
      {...props}
      photoURL={userInfo?.photoURL}
      username={userInfo?.name}
    />
  )
}

/**
 * This is our main avatar component. It will display the user's photo if it exists, otherwise it will display their initials.
 * If you want to display the user's own avatar, use the SelfAvatar component instead.
 */
export default function UserAvatar({
  photoURL,
  username,
  ...props
}: UserAvatarProps): ReactElement {
  return photoURL && username ? (
    <Avatar
      {...props}
      icon={<UserOutlined />}
      src={
        photoURL && photoURL.startsWith('http')
          ? photoURL
          : '/api/v1/profile/get_picture/' + photoURL
      }
    />
  ) : username ? (
    <Avatar
      className={`bg-[${username ? nameToRGB(username) : '#1abc9c'}] ${props.className}`}
      {...props}
      gap={2}
    >
      {getInitialsFromName(username)}
    </Avatar>
  ) : (
    <Avatar {...props} icon={<UserOutlined />} />
  )
}
