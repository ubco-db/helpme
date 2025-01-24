import React, { useEffect, useRef, useState } from 'react'
import { List, Button, Tooltip, message, Input, Popconfirm } from 'antd'
import Comment from './Comment'
import moment from 'moment'
import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { AsyncQuestion, AsyncQuestionComment, Role, User } from '@koh/common'
import { ANONYMOUS_ANIMAL_AVATAR } from '@/app/utils/constants'
import { getAnonAnimal, getAnonId } from '../utils/commonAsyncFunctions'
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
  const { userInfo } = useUserInfo()
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
      question.creator.id,
      userInfo,
      isStaff,
      showStudents,
      setIsLockedExpanded,
      regenerateComments,
      regenerateCommentsFlag,
    )
  }, [
    question.id,
    question.comments,
    question.creator.id,
    userInfo,
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
  questionCreatorId: number,
  userInfo: User,
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
    const isSelf = userInfo.id === comment.creator.id
    const isAuthor = questionCreatorId === comment.creator.id
    const anonId = getAnonId(comment.creator.id, questionId)
    // if any comment already in the list has the same anonId, generate a new one
    // NOTE: instead of doing this, I have opted for just giving them a different random colour (by setting the username of the UserAvatar to just be the creatorId + questionId)
    // let retries = 0
    // while (
    //   newComments.some(
    //     (c) => c.authorId !== comment.creator.id && c.authorAnonId === anonId,
    //   )
    // ) {
    //   retries++
    //   if (retries >= ANONYMOUS_ANIMAL_AVATAR.ANIMAL_NAMES.length) {
    //     // if we have tried all possible anonIds, just use the same one
    //     break
    //   } else {
    //     anonId = getAnonId(comment.creator.id + retries, questionId)
    //   }
    // }
    const commenterRole = comment.creator.courseRole ?? Role.STUDENT
    newComments.push({
      commentId: comment.id,
      questionId,
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
      authorId: comment.creator.id,
      authorAnonId: anonId,
      authorName: comment.creator.name,
      // (IAmStaff && showStudents) || isStaffComment
      //   ? comment.creator.name
      //   : `Anonymous ${getAnonAnimal(anonId)}`,
      photoURL: comment.creator.photoURL,
      // (IAmStaff && showStudents) || isStaffComment
      //   ? comment.creator.photoURL
      //   : `${ANONYMOUS_ANIMAL_AVATAR.URL}/${getAnonAnimal(anonId)}.png`,
      content: comment.commentText,
      datetime: (
        <Tooltip title={new Date(comment.createdAt).toLocaleString()}>
          {getAsyncWaitTime(comment.createdAt)} ago
        </Tooltip>
      ),
      commenterRole,
      authorType: isSelf ? 'you' : isAuthor ? 'author' : commenterRole,
      IAmStaff,
      showStudents,
      setIsLockedExpanded,
    })
  }

  return newComments
}

export default CommentSection
