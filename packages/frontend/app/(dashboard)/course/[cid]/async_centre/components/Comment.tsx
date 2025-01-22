import MarkdownCustom from '@/app/components/Markdown'
import UserAvatar from '@/app/components/UserAvatar'
import { cn, getErrorMessage } from '@/app/utils/generalUtils'
import { Role } from '@koh/common'
import { CommentProps } from '../utils/types'
import { CheckOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { Button, Input, message, Popconfirm, Tooltip } from 'antd'
import CircleButton from '../../queue/[qid]/components/CircleButton'
import { useState } from 'react'
import { useMediaQuery } from '@/app/hooks/useMediaQuery'
import { API } from '@/app/api'

const { TextArea } = Input

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
  commentId,
  questionId,
  onDeleteSuccess,
  onEditSuccess,
  setIsLockedExpanded,
  authorName,
  avatar,
  content,
  datetime,
  authorType,
}) => {
  const [deleteLoading, setDeleteLoading] = useState(false)
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [isEditing, setIsEditing] = useState(false)
  const [newContent, setNewContent] = useState(content)
  const [editLoading, setEditLoading] = useState(false)

  return (
    <div className="overflow-auto border-b border-gray-200 py-3">
      {/* Avatar */}
      <figure
        className="float-left mb-1 mr-3"
        style={{ width: 40, height: 40 }}
      >
        <UserAvatar
          size={40}
          username={authorName}
          photoURL={avatar}
          className="mr-2 hidden md:flex"
          anonymous
        />
      </figure>
      <UserAvatar
        size={34}
        username={authorName}
        photoURL={avatar}
        className="mr-2 flex md:hidden"
        anonymous
      />

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
        {!isEditing ? (
          <div className="childrenMarkdownFormatted">
            <MarkdownCustom>{content}</MarkdownCustom>
          </div>
        ) : (
          <TextArea
            maxLength={10000}
            autoSize={{ minRows: 1, maxRows: 12 }}
            value={newContent}
            onChange={(e) => {
              setNewContent(e.target.value)
            }}
          />
        )}
      </div>
      {/* Edit/Delete buttons */}
      {authorType === 'you' && (
        <div className="clear-both">
          {!isEditing ? (
            <>
              <Popconfirm
                className=""
                title="Are you sure you want to delete your comment?"
                okText="Yes"
                cancelText="No"
                okButtonProps={{ loading: deleteLoading }}
                onConfirm={async (e) => {
                  e?.stopPropagation()
                  setDeleteLoading(true)
                  await API.asyncQuestions
                    .deleteComment(questionId, commentId)
                    .then(() => {
                      message.success('Comment Deleted')
                      onDeleteSuccess()
                    })
                    .catch((e) => {
                      message.error(
                        'Failed to delete comment: ' + getErrorMessage(e),
                      )
                    })
                    .finally(() => {
                      setDeleteLoading(false)
                    })
                }}
              >
                <Tooltip title={isMobile ? '' : 'Delete Comment'}>
                  <CircleButton customVariant="red" icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
              <Tooltip title={isMobile ? '' : 'Edit Your Comment'}>
                <CircleButton
                  className="mt-0"
                  icon={<EditOutlined />}
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsEditing(true)
                    setIsLockedExpanded(true)
                  }}
                />
              </Tooltip>
            </>
          ) : (
            <>
              <Button
                className="ml-2"
                onClick={(e) => {
                  e.stopPropagation()
                  setNewContent(content)
                  setIsEditing(false)
                  setIsLockedExpanded(false)
                }}
                danger
                variant="outlined"
              >
                Cancel
              </Button>
              <Tooltip title={isMobile ? '' : 'Done Editing'}>
                <CircleButton
                  customVariant="green"
                  className="mt-0"
                  icon={<CheckOutlined />}
                  loading={editLoading}
                  onClick={async (e) => {
                    e.stopPropagation()
                    setEditLoading(true)
                    await API.asyncQuestions
                      .updateComment(questionId, commentId, {
                        commentText: newContent,
                      })
                      .then(() => {
                        message.success('Comment Updated')
                        onEditSuccess(newContent)
                        setIsEditing(false)
                        setIsLockedExpanded(false)
                      })
                      .catch((e) => {
                        message.error(
                          'Failed to update comment: ' + getErrorMessage(e),
                        )
                      })
                      .finally(() => {
                        setEditLoading(false)
                      })
                  }}
                />
              </Tooltip>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default Comment
