import { useState } from 'react'
import { Button, Col, message, Row } from 'antd'
import { AsyncQuestion, asyncQuestionStatus } from '@koh/common'
import { DownOutlined, UpOutlined } from '@ant-design/icons'
import { API } from '@/app/api'
import UserAvatar from '@/app/components/UserAvatar'
import { cn, getErrorMessage } from '@/app/utils/generalUtils'
import { QuestionTagElement } from '../../components/QuestionTagElement'
import { getAsyncWaitTime } from '@/app/utils/timeFormatUtils'
import TAAsyncQuestionCardButtons from './TAAsyncQuestionCardButtons'
import StudentAsyncQuestionCardButtons from './StudentAsyncQuestionCardButtons'
import { ArrowBigDown, ArrowBigUp } from 'lucide-react'

const statusDisplayMap = {
  [asyncQuestionStatus.AIAnsweredNeedsAttention]:
    'AI Answered, Needs Attention',
  [asyncQuestionStatus.AIAnsweredResolved]: 'AI Answered, Resolved',
  [asyncQuestionStatus.HumanAnswered]: 'Answered by Human',
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
  onQuestionTypeClick: (questionType: any) => void
}

const AsyncQuestionCard: React.FC<AsyncQuestionCardProps> = ({
  question,
  isStaff,
  userId,
  courseId,
  mutateAsyncQuestions,
  onQuestionTypeClick,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [voteCount, setVoteCount] = useState(question.votesSum)
  const [thisUserThisQuestionVote, setThisUserThisQuestionVote] = useState(
    question.votes?.find((vote) => vote.userId === userId)?.vote,
  )
  const shouldFlash =
    question.status === asyncQuestionStatus.AIAnswered &&
    userId === question.creatorId

  const handleFeedback = async (resolved: boolean) => {
    if (!question.id) {
      message.error('Question ID not found')
      return
    }
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
        question.status === asyncQuestionStatus.HumanAnswered ||
          question.status === asyncQuestionStatus.AIAnsweredResolved
          ? 'bg-green-100/50'
          : 'bg-yellow-100/50',
      )}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      {!question.id || !question.status ? (
        <div className="text-center">Loading...?</div>
      ) : (
        <>
          <Row wrap={false}>
            <Col flex="none" className="mr-4 items-center justify-center">
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
              <div className="my-2 flex items-center justify-center">
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
              <div className="mb-4">
                <div className="justify between flex items-start">
                  {(isStaff || userId == question.creatorId) &&
                  question.creator ? (
                    <>
                      <UserAvatar
                        size={46}
                        username={question.creator.name}
                        photoURL={question.creator.photoURL}
                        className="mr-3"
                      />
                      <div className="flex-grow text-sm italic">
                        {question.creator.name}
                      </div>
                    </>
                  ) : (
                    <div className="flex-grow text-sm italic">
                      Anonymous Student
                    </div>
                  )}
                  <div
                    className={`flex flex-grow items-center justify-center rounded-full px-2 py-1
          ${
            question.status === asyncQuestionStatus.HumanAnswered
              ? 'bg-green-200'
              : 'bg-yellow-200'
          }`}
                  >
                    {statusDisplayMap[question.status]}
                  </div>
                  <div className="flex items-center">
                    <div className="text-sm">{getAsyncWaitTime(question)}</div>
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
                <div>
                  <h4 className="font-bold">{question.questionAbstract}</h4>
                  {isExpanded && (
                    <div>
                      {question.questionText && (
                        <div>{question.questionText}</div>
                      )}

                      {question.answerText ? (
                        <>
                          <br />
                          <div>
                            <strong>Answer:</strong>
                            <div>{question.answerText}</div>
                          </div>
                        </>
                      ) : (
                        <></>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap">
                  {question.questionTypes?.map((questionType, index) => (
                    <QuestionTagElement
                      key={index}
                      tagName={questionType.name}
                      tagColor={questionType.color}
                      onClick={() => onQuestionTypeClick(questionType.id)}
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
                    <Button onClick={() => handleFeedback(true)}>
                      Satisfied
                    </Button>
                    <Button
                      type="primary"
                      onClick={() => handleFeedback(false)}
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
        </>
      )}
    </div>
  )
}

export default AsyncQuestionCard
