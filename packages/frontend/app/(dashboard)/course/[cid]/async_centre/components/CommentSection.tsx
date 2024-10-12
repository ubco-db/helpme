import React, { useEffect, useRef, useState } from 'react'
import { List, Button, Tooltip, message, Form, Empty } from 'antd'
import Comment from './Comment'
import moment from 'moment'
import TextArea from 'antd/es/input/TextArea'
import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { AsyncQuestion } from '@koh/common'
import { ANONYMOUS_ANIMAL_AVATAR } from '@/app/utils/constants'

interface CommentSectionProps {
  question: AsyncQuestion
}

interface CommentProps {
  author: string
  avatar: string | undefined
  content: string
  datetime: React.ReactNode
}

const CommentSection: React.FC<CommentSectionProps> = ({ question }) => {
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
        const isCommenter = userInfo.id === comment.creator.id
        return {
          author: isCommenter
            ? comment.creator.name
            : `Anonymous ${getAnimalNameForUser(comment.creator.id)}`,
          avatar: !isCommenter
            ? `${ANONYMOUS_ANIMAL_AVATAR.URL}/${getAnimalNameForUser(comment.creator.id)}`
            : undefined,
          content: comment.commentText,
          datetime: (
            <Tooltip title={new Date(comment.createdAt).toLocaleString()}>
              {moment(comment.createdAt).fromNow()}
            </Tooltip>
          ),
        }
      }),
    )
  }, [question.comments, userInfo])

  const handleCommentOnPost = async (
    questionId: number,
    commentText: string,
  ) => {
    try {
      const res: Response = await API.asyncQuestions.comment(
        questionId,
        userInfo.id,
        commentText,
      )
      if (res.status !== 200) throw new Error('Failed to post comment')

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
        },
      ])
      setShowAllComments(true)
    } catch (e) {
      message.error('Failed to post reply: ' + getErrorMessage(e))
    }
  }

  return (
    <React.Fragment>
      {comments && comments?.length > 0 ? (
        <React.Fragment>
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
          <Button
            type="link"
            onClick={(e) => {
              e.stopPropagation()
              setShowAllComments(!showAllComments)
            }}
          >
            {showAllComments ? 'Hide all comments' : `View all comments`}
          </Button>
        </React.Fragment>
      ) : (
        <React.Fragment>
          <strong>Comments: </strong>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No comments yet"
          />
        </React.Fragment>
      )}
      <div>
        {!showCommentTextInput && (
          <Button
            type="primary"
            onClick={(e) => {
              e.stopPropagation()
              setShowCommentTextInput(!showCommentTextInput)
            }}
            className="mb-2"
          >
            Comment on this post
          </Button>
        )}
        {showCommentTextInput && (
          <React.Fragment>
            <Form.Item className="mb-0">
              <Button
                type="primary"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowCommentTextInput(!showCommentTextInput)
                }}
                className="mb-1 mr-1"
              >
                {showCommentTextInput ? 'Cancel' : 'Comment on this post'}
              </Button>
              <Button
                htmlType="submit"
                onClick={(e) => {
                  e.stopPropagation()
                  if (commentInputValue) {
                    handleCommentOnPost(question.id, commentInputValue)
                    setCommentInputValue('')
                  }
                }}
                type="primary"
              >
                Add Comment
              </Button>
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
          </React.Fragment>
        )}
      </div>
    </React.Fragment>
  )
}

export default CommentSection
