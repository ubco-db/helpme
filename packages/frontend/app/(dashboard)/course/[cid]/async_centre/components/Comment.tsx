import MarkdownCustom from '@/app/components/Markdown'
import UserAvatar from '@/app/components/UserAvatar'
import { cn } from '@/app/utils/generalUtils'
import { Role } from '@koh/common'
import { CommentProps } from '../utils/types'

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
  [Role.PROFESSOR]: '(Prof)',
}

const Comment: React.FC<CommentProps> = ({
  authorName,
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
          username={authorName}
          photoURL={avatar}
          className="mr-2 hidden md:flex"
          anonymous
        />
        <UserAvatar
          size={34}
          username={authorName}
          photoURL={avatar}
          className="mr-2 flex md:hidden"
          anonymous
        />
      </>

      {/* Comment content */}
      <div className="flex-1">
        <div className="mb-1 flex items-center">
          {/* Author */}
          <span className="mr-1 text-sm font-semibold italic text-gray-500">
            {authorName}
          </span>
          <span className={cn('mr-2', COLOR_CODING[authorType])}>
            {DISPLAY_TEXT_AS[authorType]}
          </span>

          {/* Datetime */}
          <span className="text-xs italic text-gray-500">{datetime}</span>
        </div>

        {/* Comment body */}
        <div className="childrenMarkdownFormatted">
          <MarkdownCustom>{content}</MarkdownCustom>
        </div>
      </div>
    </div>
  )
}

export default Comment
