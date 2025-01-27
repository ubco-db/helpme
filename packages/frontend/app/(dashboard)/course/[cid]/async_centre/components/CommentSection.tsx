import React, { useEffect, useRef, useState } from 'react'
import { List, Button, Tooltip, message, Input, Popconfirm } from 'antd'
import Comment from './Comment'
import moment from 'moment'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { AsyncQuestion, AsyncQuestionComment, Role } from '@koh/common'
import { CommentProps } from '../utils/types'
import { getAsyncWaitTime } from '@/app/utils/timeFormatUtils'

const { TextArea } = Input

interface CommentSectionProps {
  userCourseRole: Role
  question: AsyncQuestion
  setIsLockedExpanded: (isLocked: boolean) => void
  showAllComments: boolean
  showStudents: boolean
}

const CommentSection: React.FC<CommentSectionProps> = ({
  userCourseRole,
  question,
  setIsLockedExpanded,
  showAllComments,
  showStudents,
}) => {
  const [showCommentTextInput, setShowCommentTextInput] = useState(false)
  const [commentInputValue, setCommentInputValue] = useState('')
  const [commentsHeight, setCommentsHeight] = useState<string | undefined>(
    undefined,
  )
  const commentsRef = useRef<HTMLDivElement>(null)
  const firstCommentRef = useRef<HTMLDivElement>(null)
  const [isPostCommentLoading, setIsPostCommentLoading] = useState(false)
  const [postCommentCancelPopoverOpen, setPostCommentCancelPopoverOpen] =
    useState(false)
  const [regenerateCommentsFlag, regenerateComments] = useState(false)
  const isStaff =
    userCourseRole === Role.TA || userCourseRole === Role.PROFESSOR

  const comments = React.useMemo(() => {
    return generateCommentData(
      question.id,
      question.comments,
      isStaff,
      showStudents,
      setIsLockedExpanded,
      regenerateComments,
      regenerateCommentsFlag,
    )
  }, [
    question.id,
    question.comments,
    isStaff,
    showStudents,
    setIsLockedExpanded,
    regenerateCommentsFlag,
  ])

  useEffect(() => {
    if (firstCommentRef.current && !showAllComments) {
      const firstCommentHeight = firstCommentRef.current.clientHeight + 50
      setCommentsHeight(`${firstCommentHeight}px`)
    } else if (commentsRef.current && showAllComments) {
      setCommentsHeight(`${commentsRef.current.scrollHeight}px`)
    }
  }, [showAllComments, comments])

  const handleCommentOnPost = async (
    questionId: number,
    commentText: string,
  ) => {
    setIsPostCommentLoading(true)
    await API.asyncQuestions
      .comment(questionId, { commentText })
      .then((newComment) => {
        message.success('Comment posted successfully')
        newComment.creator.courseRole = userCourseRole
        question.comments.push(newComment)
        setIsPostCommentLoading(false)
        regenerateComments(!regenerateCommentsFlag)
      })
      .catch((e) => {
        message.error('Failed to post reply: ' + getErrorMessage(e))
      })
  }

  const handleCancelComment = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    setShowCommentTextInput(false)
    setCommentInputValue('')
    setIsLockedExpanded(false)
  }

  if (!showAllComments) {
    return null
  }
  return (
    <>
      {comments && comments?.length > 0 ? (
        <div
          className={`mt-2`}
          ref={commentsRef}
          style={{
            maxHeight: commentsHeight,
            overflow: 'hidden',
            transition: 'max-height 0.4s ease-in-out',
          }}
        >
          <strong>Comments: </strong>
          <List
            className="overflow-hidden"
            dataSource={comments}
            renderItem={(props: CommentProps, index) => (
              <div ref={index === 0 ? firstCommentRef : undefined}>
                <Comment {...props} />
              </div>
            )}
          />
        </div>
      ) : (
        <div className="mt-2 text-gray-500">
          There are no comments here yet. Be the first to comment!
        </div>
      )}
      <div>
        {!showCommentTextInput && (
          <Button
            type="primary"
            onClick={(e) => {
              e.stopPropagation()
              setShowCommentTextInput(!showCommentTextInput)
              setIsLockedExpanded(true)
            }}
            className="mt-1"
          >
            Post Comment
          </Button>
        )}
        {showCommentTextInput && (
          <>
            <TextArea
              maxLength={10000}
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
              onConfirm={handleCancelComment}
              onOpenChange={(open) => {
                // if the field is empty, skip showing the popover and just cancel
                if (!commentInputValue) {
                  handleCancelComment()
                } else {
                  setPostCommentCancelPopoverOpen(open)
                }
              }}
              onCancel={(e) => e?.stopPropagation()}
            >
              <Button
                className="mr-2"
                onClick={(e) => e.stopPropagation()}
                danger
              >
                Cancel
              </Button>
            </Popconfirm>
            <Button
              htmlType="submit"
              className="px-6"
              disabled={!commentInputValue}
              loading={isPostCommentLoading}
              onClick={async (e) => {
                e.stopPropagation()
                if (commentInputValue) {
                  await handleCommentOnPost(question.id, commentInputValue)
                  setShowCommentTextInput(false)
                  setCommentInputValue('')
                }
              }}
              type="primary"
            >
              Post
            </Button>
          </>
        )}
      </div>
    </>
  )
}

function generateCommentData(
  questionId: number,
  comments: AsyncQuestionComment[],
  IAmStaff: boolean,
  showStudents: boolean,
  setIsLockedExpanded: (lockedExpanded: boolean) => void,
  regenerateComments: (flag: boolean) => void,
  regenerateCommentsFlag: boolean,
): CommentProps[] | undefined {
  // first sort the comments by createdAt DESC (so oldest comments appear first)
  comments.sort((a, b) => moment(a.createdAt).diff(moment(b.createdAt)))

  const newComments: CommentProps[] = []
  for (const comment of comments) {
    newComments.push({
      commentId: comment.id,
      questionId,
      author: comment.creator,
      content: comment.commentText,
      onDeleteSuccess: () => {
        // remove the comment from the question object
        const commentIndex = comments.findIndex((c) => c.id === comment.id)
        comments.splice(commentIndex, 1)
        regenerateComments(!regenerateCommentsFlag)
      },
      onEditSuccess: (newCommentText) => {
        // update the comment content
        comment.commentText = newCommentText
        regenerateComments(!regenerateCommentsFlag)
      },
      datetime: (
        <Tooltip title={new Date(comment.createdAt).toLocaleString()}>
          {getAsyncWaitTime(comment.createdAt)} ago
        </Tooltip>
      ),
      IAmStaff,
      showStudents,
      setIsLockedExpanded,
    })
  }

  return newComments
}

export default CommentSection
