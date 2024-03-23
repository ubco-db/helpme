import React, { ReactElement, useEffect, useState } from 'react'
import { Button, Card, Image, message } from 'antd'
import { Text } from '../Shared/SharedComponents'
import { QuestionType } from '../Shared/QuestionType'
import { KOHAvatar } from '../../common/SelfAvatar'
import { TAquestionDetailButtons } from './TAquestionDetailButtons'
import { getAsyncWaitTime } from '../../../utils/TimeUtil'
import { AsyncQuestion, asyncQuestionStatus } from '@koh/common'
import StudentQuestionDetailButtons from './StudentQuestionDetailButtons'
import { API } from '@koh/api-client'
import styled, { keyframes, css } from 'styled-components'
import { DownOutlined, UpOutlined } from '@ant-design/icons'

const flashAnimation = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`
const FlashingSection = styled.div<{ shouldFlash: boolean }>`
  display: flex;
  justify-content: center;
  gap: 16px; /* Adjust the space between buttons */
  margin-top: 1rem;

  ${({ shouldFlash }) =>
    shouldFlash &&
    css`
      animation: ${flashAnimation} 2s infinite;
    `};
`

const statusDisplayMap = {
  [asyncQuestionStatus.AIAnsweredNeedsAttention]:
    'AI Answered, Needs Attention',
  [asyncQuestionStatus.AIAnsweredResolved]: 'AI Answered, Resolved',
  [asyncQuestionStatus.HumanAnswered]: 'Answered by Human',
  [asyncQuestionStatus.AIAnswered]: 'Answered by AI',
  [asyncQuestionStatus.TADeleted]: 'Deleted by TA',
  [asyncQuestionStatus.StudentDeleted]: 'Deleted by Student',
}

interface AsyncCardProps {
  question: AsyncQuestion
  isStaff: boolean
  userId: number
  onStatusChange: () => void
  onQuestionTypeClick: (questionType: any) => void
}

export default function AsyncCard({
  question,
  onStatusChange,
  isStaff,
  userId,
  onQuestionTypeClick,
}: AsyncCardProps): ReactElement {
  const [isExpanded, setIsExpanded] = useState(false)
  const [voteCount, setVoteCount] = useState(question.votesSum)
  const [thisUserThisQuestionVote, setThisUserThisQuestionVote] = useState()
  const shouldFlash =
    question.status === asyncQuestionStatus.AIAnswered &&
    userId === question.creatorId

  const setIsExpandedTrue = (event) => {
    event.stopPropagation()
    setIsExpanded(true)
  }

  const handleFeedback = async (resolved) => {
    try {
      const newstatus = resolved
        ? asyncQuestionStatus.AIAnsweredResolved
        : asyncQuestionStatus.AIAnsweredNeedsAttention
      await API.asyncQuestions.update(question.id, { status: newstatus })
      message.success(
        `Question has been marked as ${
          resolved ? 'resolved' : 'needing faculty attention'
        }.`,
      )
      onStatusChange()
    } catch (error) {
      console.error('Failed to update question status', error)
      message.error('Failed to update question status. Please try again.')
    }
  }

  const handleVote = async (questionId: number, vote: number) => {
    const resp = await API.asyncQuestions.vote(questionId, vote)
    setVoteCount(resp.questionSumVotes)
  }

  useEffect(() => {
    async function getVoteForuser() {
      const resp = await API.asyncQuestions.vote(question.id, 0)
      setThisUserThisQuestionVote(resp.vote)
    }
    if (question) {
      getVoteForuser()
    }
  }, [voteCount])

  const upVoteStyle = thisUserThisQuestionVote === 1 ? { color: 'green' } : {}
  const downVoteStyle = thisUserThisQuestionVote === -1 ? { color: 'red' } : {}

  return (
    <div
      className={`mb-2 flex rounded-lg bg-white p-2 shadow-lg ${
        question.status === asyncQuestionStatus.HumanAnswered ||
        question.status === asyncQuestionStatus.AIAnsweredResolved
          ? 'bg-green-100/50'
          : 'bg-yellow-100/50'
      }`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="mr-4 flex flex-col items-center justify-center">
        <Button
          type="text"
          icon={<UpOutlined style={upVoteStyle} />}
          onClick={(e) => {
            e.stopPropagation() // Prevent card expansion
            handleVote(question.id, 1)
          }}
        />
        <div className="my-2 flex items-center justify-center">{voteCount}</div>
        <Button
          type="text"
          icon={<DownOutlined style={downVoteStyle} />}
          onClick={(e) => {
            e.stopPropagation() // Prevent card expansion
            handleVote(question.id, -1)
          }}
        />
      </div>

      <div className="flex w-full flex-grow flex-col">
        <div className="mb-4">
          <div className="justify between flex items-start">
            {isStaff || userId == question.creatorId ? (
              <>
                <KOHAvatar
                  size={46}
                  name={question.creator.name}
                  photoURL={question.creator.photoURL}
                  className="mr-3" // Tailwind margin right
                />
                <div className="flex-grow text-sm italic">
                  {question.creator.name}
                </div>
              </>
            ) : (
              <div className="flex-grow text-sm italic">Anonymous Student</div>
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
              <Text className="text-sm">{getAsyncWaitTime(question)}</Text>
              {isStaff && (
                <>
                  <TAquestionDetailButtons
                    question={question}
                    hasUnresolvedRephraseAlert={false}
                    setIsExpandedTrue={setIsExpandedTrue}
                  />
                </>
              )}
              {userId === question.creatorId &&
              question.status === asyncQuestionStatus.AIAnswered ? (
                <>
                  {/* Students can edit their own questions, but only if question is not resolved, note that AIAnswer is default */}
                  <StudentQuestionDetailButtons
                    question={question}
                    setIsExpandedTrue={setIsExpandedTrue}
                    onStatusChange={onStatusChange}
                  />
                </>
              ) : (
                <></>
              )}
            </div>
          </div>
          <div>
            <h4 className="font-bold">{question.questionAbstract}</h4>
            {isExpanded && (
              <div>
                {question.questionText && <Text>{question.questionText}</Text>}

                {question.answerText ? (
                  <>
                    <br />
                    <div>
                      <strong>Answer:</strong>
                      <Text>{question.answerText}</Text>
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
              <QuestionType
                key={index}
                typeName={questionType.name}
                typeColor={questionType.color}
                onClick={() => onQuestionTypeClick(questionType.id)}
              />
            ))}
          </div>
        </div>
        {question.status === asyncQuestionStatus.AIAnswered &&
          userId === question.creatorId && (
            <FlashingSection shouldFlash={shouldFlash}>
              {/* Students vote on whether they still need faculty help */}
              <Button onClick={() => handleFeedback(true)}>Satisfied</Button>
              <Button type="primary" onClick={() => handleFeedback(false)}>
                Still need faculty Help
              </Button>
            </FlashingSection>
          )}
      </div>
    </div>
  )
}
