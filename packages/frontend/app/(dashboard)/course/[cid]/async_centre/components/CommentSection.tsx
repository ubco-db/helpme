import React, { useEffect, useRef, useState } from 'react'
import { List, Button, Tooltip, message, Form, Empty, Popconfirm } from 'antd'
import Comment from './Comment'
import moment from 'moment'
import TextArea from 'antd/es/input/TextArea'
import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { AsyncQuestion, Role } from '@koh/common'
import { ANONYMOUS_ANIMAL_AVATAR } from '@/app/utils/constants'
import { QuestionCircleOutlined } from '@ant-design/icons'

interface CommentSectionProps {
  isStaff: boolean
  question: AsyncQuestion
  setLockedExpanded: (isLocked: boolean) => void
}

interface CommentProps {
  author: string
  avatar: string | undefined
  content: string
  datetime: React.ReactNode
  authorType: string | undefined
}

const CommentSection: React.FC<CommentSectionProps> = ({
  isStaff,
  question,
  setLockedExpanded,
}) => {
  const [showCommentTextInput, setShowCommentTextInput] = useState(false)
  const [comments, setComments] = useState<CommentProps[]>()
  const [commentInputValue, setCommentInputValue] = useState('')
  const [showAllComments, setShowAllComments] = useState(false)
  const [commentsHeight, setCommentsHeight] = useState<string | undefined>(
    undefined,
  )
  const commentsRef = useRef<HTMLDivElement>(null)
  const firstCommentRef = useRef<HTMLDivElement>(null)
  const { userInfo } = useUserInfo()

  const userAnimalMap: { [key: number]: string } = {}

  const getAnimalNameForUser = (userId: number) => {
    if (!userAnimalMap[userId]) {
      userAnimalMap[userId] =
        ANONYMOUS_ANIMAL_AVATAR.ANIMAL_NAMES[
          Math.floor(
            Math.random() * ANONYMOUS_ANIMAL_AVATAR.ANIMAL_NAMES.length,
          )
        ]
    }
    return userAnimalMap[userId]
  }

  useEffect(() => {
    if (firstCommentRef.current && !showAllComments) {
      const firstCommentHeight = firstCommentRef.current.clientHeight + 50
      setCommentsHeight(`${firstCommentHeight}px`)
    } else if (commentsRef.current && showAllComments) {
      setCommentsHeight(`${commentsRef.current.scrollHeight}px`)
    }
  }, [showAllComments, comments])

  useEffect(() => {
    setComments(
      question.comments?.map((comment) => {
        const isSelf = userInfo.id === comment.creator.id
        const isAuthor = question.creator.id === comment.creator.id
        const isCommentedByStaff =
          comment.creator.userRole === Role.TA ||
          comment.creator.userRole === Role.PROFESSOR

        return {
          author:
            isStaff || isSelf || isCommentedByStaff
              ? comment.creator.name
              : `Anonymous ${getAnimalNameForUser(comment.creator.id)}`,
          avatar:
            isStaff || isSelf || isCommentedByStaff
              ? comment.creator.photoURL
              : `${ANONYMOUS_ANIMAL_AVATAR.URL}/${getAnimalNameForUser(comment.creator.id)}`,
          content: comment.commentText,
          datetime: (
            <Tooltip title={new Date(comment.createdAt).toLocaleString()}>
              {moment(comment.createdAt).fromNow()}
            </Tooltip>
          ),
          authorType: isSelf
            ? 'you'
            : isAuthor
              ? 'author'
              : comment.creator.userRole,
        }
      }),
    )
  }, [
    getAnimalNameForUser,
    isStaff,
    question.comments,
    question.creator.id,
    userInfo,
  ])

  const handleCommentOnPost = async (
    questionId: number,
    commentText: string,
  ) => {
    await API.asyncQuestions
      .comment(questionId, userInfo.id, commentText)
      .then(() => {
        message.success('Comment posted successfully')
        setComments([
          ...(comments || []),
          {
            author: userInfo.name,
            avatar: userInfo.photoURL,
            content: commentText,
            datetime: (
              <Tooltip title={new Date().toLocaleString()}>
                {moment().fromNow()}
              </Tooltip>
            ),
            authorType: 'you',
          },
        ])
        setShowAllComments(true)
      })
      .catch((e) => {
        message.error('Failed to post reply: ' + getErrorMessage(e))
      })
  }

  return (
    <>
      {comments && comments?.length > 0 && (
        <>
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
          {comments && comments.length > 1 && (
            <Button
              type="link"
              onClick={(e) => {
                e.stopPropagation()
                setShowAllComments(!showAllComments)
              }}
            >
              {showAllComments ? 'Hide comments' : `View comments`}
            </Button>
          )}
        </>
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
            Comment on this post
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
                    onClick={(e) => {
                      e.stopPropagation()
                      if (commentInputValue) {
                        handleCommentOnPost(question.id, commentInputValue)
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

export default CommentSection
