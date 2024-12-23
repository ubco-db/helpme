import MarkdownCustom from '@/app/components/Markdown'
import UserAvatar from '@/app/components/UserAvatar'
import { cn } from '@/app/utils/generalUtils'
import { Role } from '@koh/common'
import React from 'react'

interface CommentProps {
  author: string
  avatar: string | undefined
  content: string
  datetime: React.ReactNode
  authorType: string | undefined
}

const COLOR_CODING = {
  ['you']: 'text-green-500',
  ['author']: 'text-blue-500',
  [Role.STUDENT]: 'text-gray-500',
  [Role.TA]: 'text-purple-500',
  [Role.PROFESSOR]: 'text-red-500',
}

const DISPLAY_TEXT_AS = {
  ['you']: '(You)',
  ['author']: '(Author)',
  [Role.STUDENT]: '',
  [Role.TA]: '(TA)',
  [Role.PROFESSOR]: '(Professor)',
}

const Comment: React.FC<CommentProps> = ({
  author,
  avatar,
  content,
  datetime,
  authorType,
}) => {
  return (
    <div className="flex items-center border-b border-gray-200 py-3">
      {/* Avatar */}
      <>
        <UserAvatar
          size={40}
          username={author}
          photoURL={avatar}
          className="mr-2 hidden md:flex"
          anonymous
        />
        <UserAvatar
          size={34}
          username={author}
          photoURL={avatar}
          className="mr-2 flex md:hidden"
          anonymous
        />
      </>

      {/* Comment content */}
      <div className="flex-1">
        <div className="mb-1 flex items-center">
          {/* Author */}
          <span className="mr-1 font-semibold text-black">{author}</span>
          <span
            className={cn(
              'mr-2',
              authorType
                ? COLOR_CODING[authorType as keyof typeof COLOR_CODING]
                : '',
            )}
          >
            {authorType
              ? DISPLAY_TEXT_AS[authorType as keyof typeof DISPLAY_TEXT_AS]
              : ''}
          </span>

          {/* Datetime */}
          <span className="text-sm text-gray-500">{datetime}</span>
        </div>

        {/* Comment body */}
        <MarkdownCustom>{content}</MarkdownCustom>
      </div>
    </div>
  )
}

export default Comment
