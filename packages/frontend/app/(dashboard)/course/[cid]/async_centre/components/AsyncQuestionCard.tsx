import { useState } from 'react'
import { Button, Col, message, Row, Tag, Tooltip } from 'antd'
import { AsyncQuestion, asyncQuestionStatus } from '@koh/common'
import {
  CheckCircleOutlined,
  DownOutlined,
  EyeInvisibleOutlined,
  UpOutlined,
} from '@ant-design/icons'
import { API } from '@/app/api'
import UserAvatar from '@/app/components/UserAvatar'
import { cn, getErrorMessage } from '@/app/utils/generalUtils'
import { QuestionTagElement } from '../../components/QuestionTagElement'
import { getAsyncWaitTime } from '@/app/utils/timeFormatUtils'
import TAAsyncQuestionCardButtons from './TAAsyncQuestionCardButtons'
import StudentAsyncQuestionCardButtons from './StudentAsyncQuestionCardButtons'
import { ArrowBigDown, ArrowBigUp } from 'lucide-react'

const statusDisplayMap = {
  // if the question has no answer text, it will say "awaiting answer"
  [asyncQuestionStatus.AIAnsweredNeedsAttention]:
    'AI Answered, Needs Attention',
  [asyncQuestionStatus.AIAnsweredResolved]: 'AI Answered, Resolved',
  [asyncQuestionStatus.HumanAnswered]: 'Human Verified',
  [asyncQuestionStatus.AIAnswered]: 'Answered by AI',
  [asyncQuestionStatus.TADeleted]: 'Deleted by TA',
  [asyncQuestionStatus.StudentDeleted]: 'Deleted by Student',
}

interface AsyncQuestionCardProps {
  question: AsyncQuestion
  isStaff: boolean
  userId: number
  courseId: number
  mutateAsyncQuestions: () => void
}

const AsyncQuestionCard: React.FC<AsyncQuestionCardProps> = ({
  question,
  isStaff,
  userId,
  courseId,
  mutateAsyncQuestions,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [truncateText, setTruncateText] = useState(true) // after the max-height transition is finished on expanding the text, truncate it to show a `...`
  const [voteCount, setVoteCount] = useState(question.votesSum)
  const [thisUserThisQuestionVote, setThisUserThisQuestionVote] = useState(
    question.votes?.find((vote) => vote.userId === userId)?.vote,
  )
  const shouldFlash =
    question.status === asyncQuestionStatus.AIAnswered &&
    userId === question.creatorId

  const showUser = (isStaff || userId == question.creatorId) && question.creator

  const handleFeedback = async (resolved: boolean) => {
    const newstatus = resolved
      ? asyncQuestionStatus.AIAnsweredResolved
      : asyncQuestionStatus.AIAnsweredNeedsAttention
    await API.asyncQuestions
      .update(question.id, { status: newstatus })
      .then(() => {
        mutateAsyncQuestions()
        message.success(
          `Question has been marked as ${
            resolved ? 'resolved' : 'needing faculty attention'
          }.`,
        )
      })
      .catch((e) => {
        const errorMessage = getErrorMessage(e)
        message.error('Failed to update question status:', errorMessage)
      })
  }

  const handleVote = async (questionId: number, vote: number) => {
    const resp = await API.asyncQuestions.vote(questionId, vote)
    setVoteCount(resp.questionSumVotes)
    setThisUserThisQuestionVote(resp.vote)
  }
  return (
    <div
      className={cn(
        'mb-2 mt-2 flex flex-col rounded-lg bg-white p-2 shadow-lg',
        isStaff &&
          (question.status === asyncQuestionStatus.AIAnswered ||
            question.status === asyncQuestionStatus.AIAnsweredNeedsAttention ||
            !question.answerText)
          ? 'outline outline-1 outline-offset-1 outline-yellow-500'
          : '',
      )}
      onClick={() => {
        setIsExpanded(!isExpanded)
        // after the max-height transition is finished on expanding the text, truncate it to show a `...`
        // truncating the questionText before the animation is finished will cause the animation to jump
        // Also, this logic is reversed for some reason
        if (isExpanded) {
          //// Collapsing the card
          setTimeout(() => {
            setTruncateText(true)
          }, 300)
        } else {
          //// Expanding the card
          // however, we do want to instantly remove the truncation when expanding the card
          setTruncateText(false)
        }
      }}
    >
      <Row wrap={false}>
        <Col flex="none" className="mr-1 items-center justify-center md:mr-2">
          <Button
            type="text"
            icon={
              <ArrowBigUp
                style={
                  thisUserThisQuestionVote == 1
                    ? { color: 'green' }
                    : { color: 'gray' }
                }
              />
            }
            onClick={(e) => {
              e.stopPropagation() // Prevent card expansion
              if (question.id) {
                handleVote(question.id, 1)
              }
            }}
          />
          <div className="my-1 flex items-center justify-center md:my-2">
            {voteCount}
          </div>
          <Button
            type="text"
            icon={
              <ArrowBigDown
                style={
                  thisUserThisQuestionVote == -1
                    ? { color: 'red' }
                    : { color: 'gray' }
                }
              />
            }
            onClick={(e) => {
              e.stopPropagation() // Prevent card expansion
              if (question.id) {
                handleVote(question.id, -1)
              }
            }}
          />
        </Col>

        <Col flex="auto" className="w-full">
          <div className="mb-1 flex flex-col md:mb-4">
            <div className="mb-1 flex justify-between">
              <div className="flex flex-grow">
                {showUser && (
                  <>
                    <UserAvatar
                      size={40}
                      username={question.creator.name}
                      photoURL={question.creator.photoURL}
                      className="mr-2 hidden md:flex"
                    />
                    <UserAvatar
                      size={34}
                      username={question.creator.name}
                      photoURL={question.creator.photoURL}
                      className="mr-2 flex md:hidden"
                    />
                  </>
                )}
                <div className="flex flex-grow flex-col justify-between md:flex-row">
                  <div
                    className={`flex-grow text-sm italic text-gray-500 ${showUser && 'md:pt-2.5'}`}
                  >
                    <span className="mr-2 font-semibold">
                      {showUser ? question.creator.name : 'Anonymous Student'}
                    </span>
                    <span>{getAsyncWaitTime(question)} ago</span>
                  </div>
                  <div>
                    {/* If it's the students' question, show a tag to indicate whether it is publicly visible or not */}
                    {(userId === question.creatorId || isStaff) && (
                      <Tooltip
                        title={
                          isStaff
                            ? question.visible
                              ? 'This question was marked public by a staff member and can be seen by all students'
                              : 'Only you and the question creator can see this question'
                            : question.visible
                              ? "A Staff member liked your question and decided to make it publicly visible. Don't worry! Your name and picture are hidden and you appear as an anonymous student."
                              : 'Only you and staff can see this question.'
                        }
                      >
                        <Tag
                          color={question.visible ? 'blue' : 'default'}
                          icon={
                            question.visible ? null : <EyeInvisibleOutlined />
                          }
                        >
                          {question.visible ? 'Public' : 'Private'}
                        </Tag>
                      </Tooltip>
                    )}
                    <Tag
                      icon={
                        question.verified && (
                          <Tooltip title="This Question's Answer was marked as Verified by Staff">
                            <CheckCircleOutlined />
                          </Tooltip>
                        )
                      }
                      color={
                        question.status === asyncQuestionStatus.HumanAnswered
                          ? 'green'
                          : 'gold'
                      }
                    >
                      {!question.answerText
                        ? 'Awaiting Answer'
                        : statusDisplayMap[question.status]}
                    </Tag>
                  </div>
                </div>
              </div>

              <div
                onClick={(e) => {
                  e.stopPropagation()
                }}
                className="flex items-center"
              >
                {isStaff ? (
                  <TAAsyncQuestionCardButtons
                    question={question}
                    onAsyncQuestionUpdate={mutateAsyncQuestions}
                  />
                ) : userId === question.creatorId &&
                  question.status === asyncQuestionStatus.AIAnswered ? (
                  <>
                    {/* Students can edit their own questions, but only if question is not resolved, note that AIAnswer is default */}
                    <StudentAsyncQuestionCardButtons
                      question={question}
                      onAsyncQuestionUpdate={mutateAsyncQuestions}
                      courseId={courseId}
                    />
                  </>
                ) : null}
              </div>
            </div>
            <div className="flex-grow">
              <h4 className="font-bold">{question.questionAbstract}</h4>

              {/* When not expanded, show only 1 line of the questionText */}
              <div
                className={cn(
                  'expandable-text',
                  isExpanded ? 'expanded' : '',
                  truncateText ? 'line-clamp-1' : '',
                )}
              >
                {question.questionText}
                {question.answerText && (
                  <>
                    <br />
                    <br />
                    <strong>Answer:</strong>
                    <br />
                    {question.answerText}
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-wrap">
              {question.questionTypes?.map((questionType, index) => (
                <QuestionTagElement
                  key={index}
                  tagName={questionType.name}
                  tagColor={questionType.color}
                />
              ))}
            </div>
          </div>
          {question.status === asyncQuestionStatus.AIAnswered &&
            userId === question.creatorId && (
              <div
                className={cn(
                  'flex justify-center gap-4',
                  shouldFlash ? 'flashing' : '',
                )}
              >
                {/* Students vote on whether they still need faculty help */}
                <Button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleFeedback(true)
                  }}
                >
                  Satisfied
                </Button>
                <Button
                  type="primary"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleFeedback(false)
                  }}
                >
                  Still need faculty Help
                </Button>
              </div>
            )}
        </Col>
      </Row>
      <Row className="justify-center">
        {isExpanded ? <UpOutlined /> : <DownOutlined />}
      </Row>
    </div>
  )
}

export default AsyncQuestionCard
