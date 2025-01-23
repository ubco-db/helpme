import { UserOutlined } from '@ant-design/icons'
import { Avatar, AvatarProps } from 'antd'
import React, { ReactElement } from 'react'
import { useUserInfo } from '../contexts/userContext'
import { cn, getInitialsFromName, nameToRGB } from '../utils/generalUtils'
import Image from 'next/image'

type SelfAvatarProps = Omit<AvatarProps, 'icon' | 'src'>
type UserAvatarProps = Omit<AvatarProps, 'icon' | 'src'> & {
  photoURL?: string
  username?: string
  anonymous?: boolean
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
  className,
  anonymous,
  ...props
}: UserAvatarProps): ReactElement {
  const fontSize =
    props.size && Number(props.size) > 80 ? Number(props.size) / 4 : 18
  const sizeNumber = Number(props.size) || 40

  return photoURL && username ? (
    <Avatar
      className={cn(className)}
      {...props}
      icon={<UserOutlined />}
      style={
        anonymous
          ? {
              backgroundColor: nameToRGB(username), // using tailwind by doing bg-[${nameToRGB(username)}] does not seem to work
            }
          : {}
      }
      src={
        photoURL &&
        (photoURL.startsWith('http') || photoURL.startsWith('/')) ? (
          <Image
            src={photoURL}
            alt={`${username}'s PFP`}
            loading="lazy"
            decoding="async"
            width={sizeNumber}
            height={sizeNumber}
          />
        ) : (
          <Image
            src={`api/v1/profile/get_picture/${photoURL}`}
            alt={`${username}'s PFP`}
            width={sizeNumber}
            height={sizeNumber}
            loading="lazy"
            decoding="async"
          />
        )
      }
    />
  ) : username ? (
    <Avatar
      style={{
        backgroundColor: nameToRGB(username), // using tailwind by doing bg-[${nameToRGB(username)}] does not seem to work
        fontSize: `${fontSize}px`,
      }}
      className={cn(`font-normal`, className)}
      {...props}
      gap={2}
    >
      {getInitialsFromName(username)}
    </Avatar>
  ) : (
    <Avatar
      className={cn('bg-[#1abc9c]', className)}
      {...props}
      icon={<UserOutlined />}
    />
  )
}
