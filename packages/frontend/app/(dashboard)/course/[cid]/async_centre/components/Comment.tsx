import MarkdownCustom from '@/app/components/Markdown'
import UserAvatar from '@/app/components/UserAvatar'
import { cn, getErrorMessage } from '@/app/utils/generalUtils'
import { Role } from '@koh/common'
import { CommentProps } from '../utils/types'
import {
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  MoreOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import {
  Button,
  Checkbox,
  Dropdown,
  Input,
  message,
  Popconfirm,
  Tooltip,
} from 'antd'
import { useEffect, useState } from 'react'
import { API } from '@/app/api'
import { getAnonAnimal, getAvatarTooltip } from '../utils/commonAsyncFunctions'
import { ANONYMOUS_ANIMAL_AVATAR } from '@/app/utils/constants'
import { useUserInfo } from '@/app/contexts/userContext'

const { TextArea } = Input

const COLOR_CODING = {
  ['you']: 'text-green-500',
  ['author']: 'text-blue-500',
  [Role.STUDENT]: 'text-gray-500',
  [Role.TA]: 'text-purple-500',
  [Role.PROFESSOR]: 'text-teal-500',
}

const DISPLAY_TEXT_AS = {
  ['you']: '(You)',
  ['author']: '(Author)',
  [Role.STUDENT]: '',
  [Role.TA]: '(TA)',
  [Role.PROFESSOR]: '(Professor)',
  [Role.PROFESSOR + 'mobile']: '(Prof)',
}

const Comment: React.FC<CommentProps> = ({
  commentId,
  questionId,
  author,
  content,
  isAnonymous,
  questionIsAnonymous,
  onDeleteSuccess,
  onEditSuccess,
  dispatchUIStateChange,
  datetime,
  IAmStaff,
  showStudents,
  numOtherComments,
}) => {
  const { userInfo } = useUserInfo()
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [savePopoverOpen, setSavePopoverOpen] = useState(false)
  // Form state that stores the edited comment content
  const [newContent, setNewContent] = useState(content)
  const [editLoading, setEditLoading] = useState(false)
  // Form state that allows the user to specify whether or not they would like their comment to be anonymous
  const [newAnonymous, setNewAnonymous] = useState<boolean>(isAnonymous)
  useEffect(() => setNewAnonymous(isAnonymous), [isAnonymous])

  const [isUserShown, setIsUserShown] = useState(
    (IAmStaff && showStudents) || !isAnonymous,
  )

  const isSelf = userInfo.id === author.id // comment.creator.id is only defined if they're staff or if its you (or if you are staff)
  const authorType = isSelf
    ? 'you'
    : author.isAuthor
      ? 'author'
      : author.courseRole

  useEffect(() => {
    setIsUserShown((IAmStaff && showStudents) || !isAnonymous)
  }, [IAmStaff, isAnonymous, author.courseRole, showStudents])

  const avatarTooltipTitle = getAvatarTooltip(
    IAmStaff,
    showStudents,
    authorType,
  )
  const anonAnimal = getAnonAnimal(author.anonId)

  return (
    <div className="overflow-auto border-b border-gray-200 py-3">
      {/* Avatar */}
      <figure className="float-left mr-3 hidden h-10 w-10 md:flex">
        {/* Desktop Avatar */}
        <Tooltip title={avatarTooltipTitle}>
          <UserAvatar
            className={
              IAmStaff && author.courseRole === Role.STUDENT
                ? 'cursor-pointer'
                : ''
            }
            size={40}
            // the colour of the avatar is based on the username
            // the name is authorId + questionId % length of ANIMAL_NAMES
            // while the colour is just authorId + questionId
            username={isUserShown ? author.name : 'Anonymous Student'}
            colour={author.colour}
            photoURL={
              isUserShown
                ? author.photoURL
                : `${ANONYMOUS_ANIMAL_AVATAR.URL}/${anonAnimal}.png`
            }
            anonymous
            onClick={(e) => {
              if (
                IAmStaff &&
                !(
                  author.courseRole === Role.PROFESSOR ||
                  author.courseRole === Role.TA
                )
              ) {
                e?.stopPropagation()
                setIsUserShown(!isUserShown)
              }
            }}
          />
        </Tooltip>
      </figure>
      <figure className="float-left mr-3 flex h-8 w-8 md:hidden">
        {/* Mobile Avatar (a little smaller) */}
        <Tooltip title={avatarTooltipTitle}>
          <UserAvatar
            className={
              IAmStaff && author.courseRole === Role.STUDENT
                ? 'cursor-pointer'
                : ''
            }
            size={34}
            username={isUserShown ? author.name : 'Anonymous Student'}
            colour={author.colour}
            photoURL={
              isUserShown
                ? author.photoURL
                : `${ANONYMOUS_ANIMAL_AVATAR.URL}/${anonAnimal}.png`
            }
            anonymous
            onClick={(e) => {
              if (
                IAmStaff &&
                !(
                  author.courseRole === Role.PROFESSOR ||
                  author.courseRole === Role.TA
                )
              ) {
                e?.stopPropagation()
                setIsUserShown(!isUserShown)
              }
            }}
          />
        </Tooltip>
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
                    dispatchUIStateChange({ type: 'LOCK_EXPANDED' })
                  },
                  icon: <EditOutlined />,
                },
                {
                  key: 'delete',
                  onClick: (e) => {
                    e.domEvent.stopPropagation()
                  },
                  className: 'this-dropdown-has-popconfirm',
                  label: (
                    <Popconfirm
                      title="Are you sure you want to delete your comment?"
                      okText="Yes"
                      cancelText="No"
                      okButtonProps={{ loading: deleteLoading }}
                      cancelButtonProps={{ disabled: deleteLoading }}
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
                      <div className="px-3 py-[5px]">
                        <DeleteOutlined className="mr-2" />
                        Delete
                      </div>
                    </Popconfirm>
                  ),
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
            {isUserShown ? author.name : `Anonymous ${anonAnimal}`}
          </span>
          <span className={cn('mr-2', COLOR_CODING[authorType])}>
            <span className="hidden md:inline">
              {DISPLAY_TEXT_AS[authorType]}
            </span>
            {/* shorten it to just (Prof) on mobile to save space */}
            <span className="md:hidden">
              {authorType === Role.PROFESSOR
                ? DISPLAY_TEXT_AS[Role.PROFESSOR + 'mobile']
                : DISPLAY_TEXT_AS[authorType]}
            </span>
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
              setNewAnonymous(isAnonymous)
              setIsEditing(false)
              setSavePopoverOpen(false)
              dispatchUIStateChange({ type: 'UNLOCK_EXPANDED' })
            }}
            danger
            variant="outlined"
          >
            Cancel
          </Button>
          {newAnonymous != isAnonymous && numOtherComments > 0 ? (
            <Popconfirm
              open={savePopoverOpen}
              title={'Are you sure?'}
              description={
                <div className={'max-w-60 p-1'}>
                  <div>
                    By posting this,{' '}
                    <span className={'font-semibold text-red-500'}>
                      {numOtherComments} previous comments
                    </span>{' '}
                    will be made{' '}
                    <span className={'font-semibold text-red-500'}>
                      {newAnonymous ? 'anonymous' : 'non-anonymous'}.
                    </span>
                  </div>
                </div>
              }
              onOpenChange={(open) => {
                if (open) setSavePopoverOpen(open)
              }}
              onCancel={(e) => {
                e?.stopPropagation()
                setSavePopoverOpen(false)
              }}
              onConfirm={async (e) => {
                e?.stopPropagation()
                setEditLoading(true)
                const anonValue =
                  author.isAuthor && isSelf ? questionIsAnonymous : newAnonymous
                await API.asyncQuestions
                  .updateComment(questionId, commentId, {
                    commentText: newContent,
                    isAnonymous: anonValue,
                  })
                  .then(() => {
                    message.success('Comment Updated')
                    onEditSuccess(newContent, anonValue)
                    setIsEditing(false)
                    dispatchUIStateChange({ type: 'UNLOCK_EXPANDED' })
                  })
                  .catch((e) => {
                    message.error(
                      'Failed to update comment: ' + getErrorMessage(e),
                    )
                  })
                  .finally(() => {
                    setEditLoading(false)
                    setSavePopoverOpen(false)
                  })
              }}
            >
              <Button
                htmlType="submit"
                className="ml-2 px-6"
                disabled={
                  newContent === content && newAnonymous === isAnonymous
                }
                loading={editLoading}
                type="primary"
              >
                Save
              </Button>
            </Popconfirm>
          ) : (
            <Button
              className="ml-2 px-6"
              type="primary"
              loading={editLoading}
              disabled={newContent === content && newAnonymous === isAnonymous}
              onClick={async (e) => {
                e.stopPropagation()
                setEditLoading(true)
                const anonValue =
                  author.isAuthor && isSelf ? questionIsAnonymous : newAnonymous
                await API.asyncQuestions
                  .updateComment(questionId, commentId, {
                    commentText: newContent,
                    isAnonymous: anonValue,
                  })
                  .then(() => {
                    message.success('Comment Updated')
                    onEditSuccess(newContent, anonValue)
                    setIsEditing(false)
                    dispatchUIStateChange({ type: 'UNLOCK_EXPANDED' })
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
          )}
          {!author.isAuthor && (
            <span className={'mb-4 ml-5 inline-flex flex-row gap-1'}>
              <Tooltip
                title={`Set whether you will appear anonymous to other students. Staff will still see who you are.\n 
                                ${newAnonymous != isAnonymous && numOtherComments > 0 ? `Previous comments have a different anonymity setting. ${numOtherComments} comments will be made ${newAnonymous ? 'anonymous' : 'non-anonymous'}!` : 'Anonymity setting is the same as any previous comments.'}`}
              >
                <Checkbox
                  checked={newAnonymous}
                  onChange={() => setNewAnonymous(!newAnonymous)}
                >
                  <div className={'inline-flex flex-row gap-1'}>
                    <div>Post Anonymously</div>
                    <div className={'ml-1'}>
                      {newAnonymous != isAnonymous && numOtherComments > 0 ? (
                        <WarningOutlined className="animate-pulse text-lg text-red-500 hover:text-red-800" />
                      ) : (
                        <CheckCircleOutlined
                          className={
                            'text-lg text-green-500 hover:text-green-800'
                          }
                        />
                      )}
                    </div>
                  </div>
                </Checkbox>
              </Tooltip>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default Comment
