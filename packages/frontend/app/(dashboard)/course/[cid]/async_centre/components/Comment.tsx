import MarkdownCustom from '@/app/components/Markdown'
import UserAvatar from '@/app/components/UserAvatar'
import { cn, getErrorMessage } from '@/app/utils/generalUtils'
import { Role } from '@koh/common'
import { CommentProps } from '../utils/types'
import { DeleteOutlined, EditOutlined, MoreOutlined } from '@ant-design/icons'
import { Button, Dropdown, Input, message, Popconfirm } from 'antd'
import { useState } from 'react'
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
  authorId,
  content,
  datetime,
  authorType,
}) => {
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [newContent, setNewContent] = useState(content)
  const [editLoading, setEditLoading] = useState(false)

  return (
    <div className="overflow-auto border-b border-gray-200 py-3">
      {/* Avatar */}
      <figure className="float-left mr-3 hidden h-10 w-10 md:flex">
        {/* Desktop Avatar */}
        <UserAvatar
          size={40}
          // the colour of the avatar is based on the username
          // the name is authorId + questionId % length of ANIMAL_NAMES
          // while the colour is just authorId + questionId
          username={(questionId + authorId).toString()}
          photoURL={avatar}
          anonymous
        />
      </figure>
      <figure className="float-left mr-3 flex h-8 w-8 md:hidden">
        {/* Mobile Avatar (a little smaller) */}
        <UserAvatar
          size={34}
          username={(questionId + authorId).toString()}
          photoURL={avatar}
          anonymous
        />
      </figure>

      {/* Edit/Delete buttons in dropdown (floated right so that text flows around it) */}
      {authorType === 'you' && !isEditing && (
        <figure className="float-right">
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                {
                  key: 'edit',
                  label: 'Edit',
                  onClick: (e) => {
                    e.domEvent.stopPropagation()
                    setIsEditing(true)
                    setIsLockedExpanded(true)
                  },
                  icon: <EditOutlined />,
                },
                {
                  key: 'delete',
                  onClick: (e) => {
                    e.domEvent.stopPropagation()
                  },
                  label: (
                    <Popconfirm
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
                      Delete
                    </Popconfirm>
                  ),
                  icon: <DeleteOutlined />,
                  danger: true,
                },
              ],
            }}
          >
            <Button
              className="mt-1 text-xl text-gray-600"
              type="text"
              onClick={(e) => {
                e.stopPropagation()
              }}
              icon={<MoreOutlined className="mb-2" />}
            />
          </Dropdown>
        </figure>
      )}

      {/* Comment content */}
      <div className="flex-1">
        <div className=" flex items-center">
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
            className="mt-1"
            maxLength={10000}
            autoSize={{ minRows: 1, maxRows: 12 }}
            value={newContent}
            onChange={(e) => {
              setNewContent(e.target.value)
            }}
          />
        )}
      </div>

      {/* Save/Cancel buttons while editing */}
      {authorType === 'you' && isEditing && (
        <div className="clear-both mt-2">
          <Button
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
          <Button
            className="ml-2 px-6"
            type="primary"
            loading={editLoading}
            disabled={newContent === content}
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
          >
            Save
          </Button>
        </div>
      )}
    </div>
  )
}

export default Comment
