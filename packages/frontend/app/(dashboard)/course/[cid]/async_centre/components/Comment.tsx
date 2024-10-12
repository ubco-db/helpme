import MarkdownCustom from '@/app/components/Markdown'
import UserAvatar from '@/app/components/UserAvatar'
import React from 'react'

interface CommentProps {
  author: string
  avatar: string | undefined
  content: string
  datetime: React.ReactNode
}

const Comment: React.FC<CommentProps> = ({
  author,
  avatar,
  content,
  datetime,
}) => {
  return (
    <div className="flex items-center border-b border-gray-200 py-4">
      {/* Avatar */}
      <React.Fragment>
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
      </React.Fragment>

      {/* Comment content */}
      <div className="flex-1">
        <div className="mb-1 flex items-center">
          {/* Author */}
          <span className="mr-4 font-semibold text-black">{author}</span>

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
