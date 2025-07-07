import { useMemo, useState } from 'react'
import {
  Button,
  Checkbox,
  Input,
  List,
  message,
  Popconfirm,
  Tooltip,
} from 'antd'
import Comment from './Comment'
import moment from 'moment'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { AsyncQuestion, AsyncQuestionComment, Role } from '@koh/common'
import { CommentProps } from '../utils/types'
import { getAsyncWaitTime } from '@/app/utils/timeFormatUtils'
import { Action } from './AsyncQuestionCardUIReducer'
import { CheckCircleOutlined, WarningOutlined } from '@ant-design/icons'

const { TextArea } = Input

interface CommentSectionProps {
  userId: number
  userCourseRole: Role
  question: AsyncQuestion
  dispatchUIStateChange: (action: Action) => void
  isPostingComment: boolean
  showStudents: boolean
  className?: string
  defaultAnonymousSetting: boolean
}

const CommentSection: React.FC<CommentSectionProps> = ({
  userId,
  userCourseRole,
  question,
  dispatchUIStateChange,
  isPostingComment,
  showStudents,
  className,
  defaultAnonymousSetting,
}) => {
  const [commentInputValue, setCommentInputValue] = useState('')
  const [commentAnonymous, setCommentAnonymous] = useState<boolean>(
    defaultAnonymousSetting,
  )
  const [isPostCommentLoading, setIsPostCommentLoading] = useState(false)
  const [postCommentCancelPopoverOpen, setPostCommentCancelPopoverOpen] =
    useState(false)
  const [postCommentPopoverOpen, setPostCommentPopoverOpen] = useState(false)
  const [regenerateCommentsFlag, regenerateComments] = useState(false)
  const isStaff =
    userCourseRole === Role.TA || userCourseRole === Role.PROFESSOR

  const comments = useMemo(() => {
    return generateCommentProps(
      question.id,
      question.isAnonymous ?? defaultAnonymousSetting,
      question.comments,
      isStaff,
      showStudents,
      dispatchUIStateChange,
      regenerateComments,
      regenerateCommentsFlag,
    )
  }, [
    question.id,
    question.comments,
    question.isAnonymous,
    isStaff,
    showStudents,
    dispatchUIStateChange,
    regenerateCommentsFlag,
  ])

  const anonymityOverwriteCount = useMemo(
    () =>
      question.comments.filter(
        (c) =>
          c.creator.id != undefined &&
          c.creator.id == userId &&
          c.isAnonymous != commentAnonymous,
      ).length,
    [commentAnonymous, question.comments, question, regenerateCommentsFlag],
  )

  const handleCommentOnPost = async (
    questionId: number,
    commentText: string,
    isAnonymous: boolean,
  ) => {
    setIsPostCommentLoading(true)
    await API.asyncQuestions
      .comment(questionId, {
        commentText,
        isAnonymous:
          question.creatorId === userId ? question.isAnonymous : isAnonymous,
      })
      .then((comments) => {
        dispatchUIStateChange({ type: 'UNLOCK_EXPANDED' })
        message.success('Comment posted successfully')
        comments.forEach((c) => {
          if (c.creator) {
            c.creator.courseRole = userCourseRole
          }
        })
        const ids = comments.map((c) => c.id)
        question.comments.forEach((c) => {
          if (!ids.includes(c.id)) return
          c.isAnonymous = comments[0].isAnonymous
        })
        question.comments.push(comments[0])
        setIsPostCommentLoading(false)
        regenerateComments(!regenerateCommentsFlag)
      })
      .catch((e) => {
        message.error('Failed to post reply: ' + getErrorMessage(e))
      })
  }

  const handleCancelComment = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    dispatchUIStateChange({
      type: 'SET_IS_POSTING_COMMENT',
      isPostingComment: false,
    })
    setCommentInputValue('')
    if (question.comments.length === 0) {
      // if no comments were posted (e.g. they clicked "Post Comment" by accident and immediately clicked "Cancel"), immediately jump back to just 'expandedNoComments' state
      dispatchUIStateChange({ type: 'HIDE_COMMENTS' })
    } else {
      dispatchUIStateChange({ type: 'UNLOCK_EXPANDED' })
    }
  }

  return (
    <div className={className}>
      {comments && comments?.length > 0 ? (
        <div className="mt-2">
          <strong>Comments: </strong>
          <List
            className="overflow-hidden"
            dataSource={comments}
            renderItem={(props: CommentProps) => (
              <Comment key={props.commentId} {...props} />
            )}
          />
        </div>
      ) : (
        <div className="mt-2 text-gray-500">
          There are no comments here yet. Be the first to comment!
        </div>
      )}
      <div>
        {!isPostingComment && (
          <Button
            type="primary"
            onClick={(e) => {
              e.stopPropagation()
              dispatchUIStateChange({
                type: 'SET_IS_POSTING_COMMENT',
                isPostingComment: true,
              })
              dispatchUIStateChange({ type: 'LOCK_EXPANDED' })
            }}
            className="mt-1"
          >
            Post Comment
          </Button>
        )}
        {isPostingComment && (
          <>
            <TextArea
              maxLength={10000} // same as reddit's max length
              className="my-2"
              rows={4}
              placeholder="Enter your comment here..."
              onFocus={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
              }}
              onChange={(e) => setCommentInputValue(e.target.value)}
              value={commentInputValue}
            />
            <Popconfirm
              open={postCommentCancelPopoverOpen}
              title="Are you sure you want to cancel?"
              description="Your comment will be discarded"
              getPopupContainer={(trigger) => trigger.parentNode as HTMLElement}
              onConfirm={handleCancelComment}
              onOpenChange={(open) => {
                // if the field is empty, skip showing the popover and just cancel
                if (!commentInputValue) {
                  handleCancelComment()
                } else {
                  setPostCommentCancelPopoverOpen(open)
                }
                setPostCommentPopoverOpen(false)
              }}
              onCancel={(e) => e?.stopPropagation()}
            >
              <Button
                className="mr-2"
                onClick={(e) => e.stopPropagation()}
                danger
                disabled={isPostCommentLoading}
              >
                Cancel
              </Button>
            </Popconfirm>
            {anonymityOverwriteCount > 0 ? (
              <Popconfirm
                open={postCommentPopoverOpen}
                title={'Are you sure?'}
                description={
                  <div className={'max-w-60 p-1'}>
                    <div>
                      By posting this,{' '}
                      <span className={'font-semibold text-red-500'}>
                        {anonymityOverwriteCount} previous comments
                      </span>{' '}
                      will be made{' '}
                      <span className={'font-semibold text-red-500'}>
                        {commentAnonymous ? 'anonymous' : 'non-anonymous'}.
                      </span>
                    </div>
                  </div>
                }
                onOpenChange={(open) => {
                  if (open) setPostCommentPopoverOpen(open)
                }}
                onCancel={(e) => {
                  e?.stopPropagation()
                  setPostCommentPopoverOpen(false)
                }}
                onConfirm={async (e) => {
                  e?.stopPropagation()
                  if (commentInputValue) {
                    await handleCommentOnPost(
                      question.id,
                      commentInputValue,
                      commentAnonymous,
                    )
                    dispatchUIStateChange({
                      type: 'SET_IS_POSTING_COMMENT',
                      isPostingComment: false,
                    })
                    setCommentInputValue('')
                    setPostCommentPopoverOpen(false)
                  }
                }}
              >
                <Button
                  htmlType="submit"
                  className="px-6"
                  disabled={!commentInputValue}
                  loading={isPostCommentLoading}
                  type="primary"
                >
                  Post
                </Button>
              </Popconfirm>
            ) : (
              <Button
                htmlType="submit"
                className="px-6"
                disabled={!commentInputValue}
                loading={isPostCommentLoading}
                onClick={async (e) => {
                  e.stopPropagation()
                  if (commentInputValue) {
                    await handleCommentOnPost(
                      question.id,
                      commentInputValue,
                      commentAnonymous,
                    )
                    dispatchUIStateChange({
                      type: 'SET_IS_POSTING_COMMENT',
                      isPostingComment: false,
                    })
                    setCommentInputValue('')
                  }
                }}
                type="primary"
              >
                Post
              </Button>
            )}
            {question.creatorId !== userId && (
              <span className={'mb-4 ml-5 inline-flex flex-row gap-1'}>
                <Tooltip
                  title={`Set whether you will appear anonymous to other students. Staff will still see who you are.\n 
                                ${anonymityOverwriteCount > 0 ? `Previous comments have a different anonymity setting. ${anonymityOverwriteCount} comments will be made ${commentAnonymous ? 'anonymous' : 'non-anonymous'}!` : 'Anonymity setting is the same as any previous comments.'}`}
                >
                  <Checkbox
                    checked={commentAnonymous}
                    onChange={() => setCommentAnonymous(!commentAnonymous)}
                  >
                    <div className={'inline-flex flex-row gap-1'}>
                      <div>Post Anonymously</div>
                      <div className={'ml-1'}>
                        {anonymityOverwriteCount > 0 ? (
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
          </>
        )}
      </div>
    </div>
  )
}

function generateCommentProps(
  questionId: number,
  questionIsAnonymous: boolean,
  comments: AsyncQuestionComment[],
  IAmStaff: boolean,
  showStudents: boolean,
  dispatchUIStateChange: (action: Action) => void,
  regenerateComments: (flag: boolean) => void,
  regenerateCommentsFlag: boolean,
): CommentProps[] | undefined {
  // first sort the comments by createdAt DESC (so oldest comments appear first)
  comments.sort((a, b) => moment(a.createdAt).diff(moment(b.createdAt)))

  const newComments: CommentProps[] = []
  for (const comment of comments) {
    const otherUserComments = comments.filter(
      (c) => c.creator.id != undefined && c.creator.id == comment.creator.id,
    )
    newComments.push({
      commentId: comment.id,
      questionId,
      author: comment.creator,
      content: comment.commentText,
      isAnonymous: comment.isAnonymous,
      questionIsAnonymous,
      onDeleteSuccess: () => {
        // remove the comment from the question object
        const commentIndex = comments.findIndex((c) => c.id === comment.id)
        comments.splice(commentIndex, 1)
        regenerateComments(!regenerateCommentsFlag)
      },
      onEditSuccess: (newCommentText, newCommentAnonymous) => {
        // update the comment content
        comment.commentText = newCommentText
        comment.isAnonymous = newCommentAnonymous
        otherUserComments.forEach((c) => {
          c.isAnonymous = comment.isAnonymous
        })
        regenerateComments(!regenerateCommentsFlag)
      },
      datetime: (
        <Tooltip title={new Date(comment.createdAt).toLocaleString()}>
          {getAsyncWaitTime(comment.createdAt)} ago
        </Tooltip>
      ),
      IAmStaff,
      showStudents,
      dispatchUIStateChange,
      numOtherComments: otherUserComments.length,
    })
  }

  return newComments
}

export default CommentSection
