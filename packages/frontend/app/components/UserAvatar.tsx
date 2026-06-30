import { UserOutlined } from '@ant-design/icons'
import { Avatar, AvatarProps } from 'antd'
import React, { ReactElement } from 'react'
import { useUserInfo } from '../contexts/userContext'
import { cn, getInitialsFromName } from '../utils/generalUtils'
import Image from 'next/image'
import { classicPFPColours, nameToRGB } from '@koh/common'

type SelfAvatarProps = Omit<AvatarProps, 'icon' | 'src'>
type UserAvatarProps = Omit<AvatarProps, 'icon' | 'src'> & {
  photoURL?: string // Can be a url to a photo directly or the one to our server
  userId?: number
  username?: string
  anonymous?: boolean
  colour?: string // hex colour
}

export function SelfAvatar({ ...props }: SelfAvatarProps): ReactElement {
  const { userInfo } = useUserInfo()

  return (
    <UserAvatar
      {...props}
      userId={userInfo?.id}
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
  userId,
  username,
  className,
  anonymous,
  colour,
  ...props
}: UserAvatarProps): ReactElement {
  const fontSize =
    props.size && Number(props.size) > 80 ? Number(props.size) / 4 : 14
  const sizeNumber = Number(props.size) || 40

  return photoURL &&
    username &&
    (photoURL.startsWith('http') || photoURL.startsWith('/')) ? ( // external photo (or anonymous animal) ? (
    <Avatar
      className={cn(className)}
      {...props}
      icon={<UserOutlined />}
      style={
        anonymous
          ? {
              backgroundColor: colour ?? nameToRGB(username, classicPFPColours),
            }
          : {}
      }
      src={
        <Image
          src={photoURL}
          alt={`${username}'s PFP`}
          loading="lazy"
          decoding="async"
          width={sizeNumber}
          height={sizeNumber}
        />
      }
    />
  ) : username && photoURL && userId ? ( // standard pfp upload to our server (/get_pfp)
    <Avatar
      className={cn(className)}
      {...props}
      icon={<UserOutlined />}
      src={
        <Image
          src={`api/v1/profile/get_pfp/${userId}/${photoURL}`}
          alt={`${username}'s PFP`}
          width={sizeNumber}
          height={sizeNumber}
          loading="lazy"
          decoding="async"
        />
      }
    />
  ) : username ? ( // no photoId given, just show initials
    <Avatar
      style={{
        // using tailwind by doing bg-[${nameToRGB(username)}] does not seem to work
        // EDIT: this is because tailwind only generates styles for ones it can detect in our codebase. To get this to work,
        // we would just need a file (or even a comment here) with every single class that could be generated with this (which is also probably a waste of css)
        // The other way to do this (that isn't just inline styles) is to set a CSS variable or to create a html data attribute and change the style based on that (so basically just inline styles)
        backgroundColor: nameToRGB(username, classicPFPColours),
        fontSize: `${fontSize}px`,
      }}
      className={cn(`font-normal`, className)}
      {...props}
      gap={2}
    >
      {getInitialsFromName(username)}
    </Avatar>
  ) : (
    // generic fallback
    <Avatar
      style={{
        backgroundColor: colour ?? '#1abc9c',
      }}
      className={className}
      {...props}
      icon={<UserOutlined />}
    />
  )
}
