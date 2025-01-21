import React, { useEffect, useRef, useState } from 'react'
import { List, Button, Tooltip, message, Form, Empty, Popconfirm } from 'antd'
import Comment from './Comment'
import moment from 'moment'
import TextArea from 'antd/es/input/TextArea'
import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { AsyncQuestion, AsyncQuestionComment, Role, User } from '@koh/common'
import { ANONYMOUS_ANIMAL_AVATAR } from '@/app/utils/constants'
import { QuestionCircleOutlined } from '@ant-design/icons'
import { getAnonAnimal, getAnonId } from '../utils/commonAsyncFunctions'
import { CommentProps } from '../utils/types'
import { getAsyncWaitTime } from '@/app/utils/timeFormatUtils'

interface CommentSectionProps {
  isStaff: boolean
  question: AsyncQuestion
  setLockedExpanded: (isLocked: boolean) => void
  showAllComments: boolean
}

const CommentSection: React.FC<CommentSectionProps> = ({
  isStaff,
  question,
  setLockedExpanded,
  showAllComments,
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

  const comments = React.useMemo(() => {
    return generateCommentData(
      question.id,
      question.comments,
      question.creator.id,
      userInfo,
      isStaff,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    question.id,
    question.comments,
    question.creator.id,
    userInfo,
    isStaff,
    // this is just to get the useMemo to re-run when handleCommentOnPost finishes posting the comment (since updating question.comments does not re-run the useMemo because its a prop i think. And no re-assigning question.comments to a new array with the new comment does not trigger a re-run either unfortunately)
    isPostCommentLoading,
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
        question.comments.push(newComment)
        setIsPostCommentLoading(false)
      })
      .catch((e) => {
        message.error('Failed to post reply: ' + getErrorMessage(e))
      })
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
        <div className="text-gray-500">
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
              setLockedExpanded(true)
            }}
            className="my-3"
          >
            Post Comment
          </Button>
        )}
        {showCommentTextInput && (
          <>
            <Form.Item className="my-3">
              {commentInputValue ? (
                <>
                  <Popconfirm
                    title="Are you sure you want to cancel?"
                    description="Your comment will be discarded"
                    icon={<QuestionCircleOutlined style={{ color: 'red' }} />}
                    onConfirm={(e) => {
                      e?.stopPropagation()
                      setShowCommentTextInput(!showCommentTextInput)
                      setCommentInputValue('')
                      setLockedExpanded(false)
                    }}
                    onCancel={(e) => e?.stopPropagation()}
                  >
                    <Button
                      className="mr-1"
                      onClick={(e) => e.stopPropagation()}
                      danger
                    >
                      Cancel
                    </Button>
                  </Popconfirm>
                  <Button
                    htmlType="submit"
                    loading={isPostCommentLoading}
                    onClick={async (e) => {
                      e.stopPropagation()
                      if (commentInputValue) {
                        await handleCommentOnPost(
                          question.id,
                          commentInputValue,
                        )
                        setShowCommentTextInput(false)
                        setCommentInputValue('')
                      }
                    }}
                    type="primary"
                  >
                    Add Comment
                  </Button>
                </>
              ) : (
                <Button
                  className="mr-1"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowCommentTextInput(!showCommentTextInput)
                    setCommentInputValue('')
                    setLockedExpanded(false)
                  }}
                  danger
                >
                  Cancel
                </Button>
              )}
            </Form.Item>
            <Form.Item>
              <TextArea
                rows={4}
                placeholder="Enter your comment here"
                onFocus={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                }}
                onChange={(e) => setCommentInputValue(e.target.value)}
                value={commentInputValue}
              />
            </Form.Item>
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
): CommentProps[] | undefined {
  // first sort the comments by createdAt DESC (so oldest comments appear first)
  comments.sort((a, b) => moment(a.createdAt).diff(moment(b.createdAt)))

  const newComments: CommentProps[] = []
  for (const comment of comments) {
    const isSelf = userInfo.id === comment.creator.id
    const isAuthor = questionCreatorId === comment.creator.id
    const isStaffComment =
      comment.creator.courseRole === Role.TA ||
      comment.creator.courseRole === Role.PROFESSOR
    let anonId = getAnonId(comment.creator.id, questionId)
    // if any comment already in the list has the same anonId, generate a new one
    let retries = 0
    while (
      newComments.some(
        (c) => c.authorId !== comment.creator.id && c.authorAnonId === anonId,
      )
    ) {
      retries++
      if (retries >= ANONYMOUS_ANIMAL_AVATAR.ANIMAL_NAMES.length) {
        // if we have tried all possible anonIds, just use the same one
        break
      } else {
        anonId = getAnonId(comment.creator.id + retries, questionId)
      }
    }
    console.log('anonId', anonId)
    newComments.push({
      authorId: comment.creator.id,
      authorAnonId: anonId,
      authorName:
        IAmStaff || isStaffComment
          ? comment.creator.name
          : `Anonymous ${getAnonAnimal(anonId)}`,
      avatar:
        IAmStaff || isStaffComment
          ? comment.creator.photoURL
          : `${ANONYMOUS_ANIMAL_AVATAR.URL}/${getAnonAnimal(comment.creator.id)}`,
      content: comment.commentText,
      datetime: (
        <Tooltip title={new Date(comment.createdAt).toLocaleString()}>
          {getAsyncWaitTime(comment.createdAt)} ago
        </Tooltip>
      ),
      authorType: isSelf
        ? 'you'
        : isAuthor
          ? 'author'
          : (comment.creator.courseRole ?? Role.STUDENT),
    })
  }

  return newComments
}

export default CommentSection
