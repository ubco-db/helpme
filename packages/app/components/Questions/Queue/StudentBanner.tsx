import {
  DeleteRowOutlined,
  EditOutlined,
  TeamOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import { API } from '@koh/api-client'
import { ConfigTasks, OpenQuestionStatus, Question } from '@koh/common'
import { Button, Col, Popconfirm, Row, Tooltip } from 'antd'
import React, { ReactElement } from 'react'
import styled from 'styled-components'
import { useStudentQuestion } from '../../../hooks/useStudentQuestion'
import { toOrdinal } from '../../../utils/ordinal'
import Banner, { BannerButton, BannerDangerButton } from './Banner'
import { QuestionType } from '../Shared/QuestionType'

const QuestionDetailCard = styled.div<{ status: string }>`
  display: flex;
  background-color: #599cd6;
  border: 4px dashed;
  border-color: ${({ status }) => {
    switch (status) {
      case 'Drafting':
        return '#faad14'
      case 'Helping':
        return '#4dc186'
      case 'ReQueueing':
        return '#66BB6A'
      case 'PriorityQueued':
        return '#3684C6'
      default:
        return '#599cd6'
    }
  }};
  margin: 0.5rem 0;
  padding: 0.5rem;
  border-radius: 5px;
  color: white;
  min-height: 63px;

  @media (max-width: 650px) {
    padding: 0.4rem;
    margin: 0.4rem 0;
  }
`
const SpotIndicator = styled.div`
  font-size: 26px;
  font-weight: bold;
  line-height: 1;
`

interface StudentBannerProps {
  queueId: number
  editQuestion: () => void
  editDemo: () => void
  leaveQueueQuestion: () => void
  leaveQueueDemo: () => void
  configTasks?: ConfigTasks
  zoomLink?: string
  isQueueOnline: boolean
}
export default function StudentBanner({
  queueId,
  editQuestion,
  editDemo,
  leaveQueueQuestion,
  leaveQueueDemo,
  configTasks,
  zoomLink,
  isQueueOnline,
}: StudentBannerProps): ReactElement {
  const {
    studentQuestion,
    studentDemo,
    studentQuestionIndex,
    studentDemoIndex,
  } = useStudentQuestion(queueId)

  const getTitle = (
    questionStatus: string | undefined,
    demoStatus: string | undefined,
  ): string => {
    switch (questionStatus) {
      case 'Drafting':
        return 'Your Questions - Please finish writing your question'
      case 'Helping':
        return `Your Questions - ${
          studentQuestion.taHelped?.name ?? 'A TA'
        } is coming to help you`
      case 'ReQueueing':
        return 'Your Questions - Are you ready to re-join the queue?'
      case 'PriorityQueued':
        return (
          'Your Questions - You are now in a priority queue, you will be helped soon. Last helped by: ' +
          studentQuestion.taHelped.name
        )
      default:
        switch (demoStatus) {
          case 'Drafting':
            return 'Your Questions - Please finish creating your demo'
          case 'Helping':
            return `Your Questions - ${
              studentDemo.taHelped?.name ?? 'A TA'
            } is coming to check your demo`
          case 'ReQueueing':
            return 'Your Questions - Are you ready to re-join the queue?'
          case 'PriorityQueued':
            return (
              'Your Questions - You are now in a priority queue, you will be helped soon.  Last helped by: ' +
              studentQuestion.taHelped.name
            )
          default:
            return 'Your Questions'
        }
    }
  }

  if (!studentQuestion && !studentDemo) {
    return <></>
  }
  return (
    <Banner
      titleColor="#3684C6"
      contentColor="#ABD4F3"
      title={getTitle(studentQuestion?.status, studentDemo?.status)}
      content={
        <>
          <QuestionDetailRow
            question={studentQuestion}
            spot={studentQuestionIndex + 1}
            isQueueOnline={isQueueOnline}
            zoomLink={zoomLink}
            leaveQueue={leaveQueueQuestion}
            edit={editQuestion}
          />
          {studentQuestion?.status === 'Helping' && (
            <div>
              Be respectful of the TA’s time. Be prepared with your question!
            </div>
          )}
          <QuestionDetailRow
            question={studentDemo}
            configTasks={configTasks}
            spot={studentDemoIndex + 1}
            isQueueOnline={isQueueOnline}
            zoomLink={zoomLink}
            leaveQueue={leaveQueueDemo}
            edit={editDemo}
          />
          {studentDemo?.status === 'Helping' && (
            <div>
              Be respectful of the TA’s time. Be prepared with your demo!
            </div>
          )}
        </>
      }
    />
  )
}

function LeaveQueueButton({ leaveQueue }: { leaveQueue: () => void }) {
  return (
    <Popconfirm
      title={`Are you sure you want to leave the queue?`}
      okText="Yes"
      cancelText="No"
      onConfirm={leaveQueue}
    >
      <Tooltip title="Leave Queue">
        <BannerDangerButton icon={<DeleteRowOutlined />} />
      </Tooltip>
    </Popconfirm>
  )
}

function QuestionDetailRow({
  question,
  configTasks,
  spot,
  isQueueOnline,
  zoomLink,
  leaveQueue,
  edit,
}: {
  question: Question
  configTasks?: ConfigTasks
  spot: number
  isQueueOnline: boolean
  zoomLink: string
  leaveQueue: () => void
  edit: () => void
}) {
  if (!question) {
    return <></>
  }
  // task questions text comes in as "Mark "part1" "part2""
  const tasks = question.isTaskQuestion
    ? question.text.match(/"(.*?)"/g)?.map((task) => task.slice(1, -1)) || []
    : [] // gives an array of "part1","part2",etc.

  return (
    <QuestionDetailCard status={question.status}>
      {/* flex = auto fills the rest of the space */}
      <Col flex="auto">
        {question.status === 'Drafting' ? (
          <div className="my-2 flex items-center sm:ml-3">
            <span className="text-base font-medium text-orange-100 sm:text-xl">
              {question.isTaskQuestion
                ? 'Your Unfinished Demo'
                : 'Your Unfinished Question'}
            </span>
          </div>
        ) : // if it's a task question, parse the task items and display them instead of the question text
        question.isTaskQuestion && tasks && configTasks ? (
          <div>
            {tasks.map((task, index) => {
              const taskValue = configTasks[task] // get the task's background colour and name
              return (
                <QuestionType
                  key={index}
                  typeName={taskValue.display_name}
                  typeColor={taskValue.color_hex}
                />
              )
            })}
          </div>
        ) : (
          <div>
            <Row>
              <Tooltip // only show tooltip if text is too long
                title={question.text.length > 110 ? question.text : ''}
                overlayStyle={{ maxWidth: '60em' }}
              >
                <div
                  style={
                    {
                      // shorten question text dynamically
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      maxWidth: '95em',
                    } as React.CSSProperties
                  }
                >
                  {question.text}
                </div>
              </Tooltip>
            </Row>
            <Row>
              {question.questionTypes?.map((questionType, index) => (
                <QuestionType
                  key={index}
                  typeName={questionType.name}
                  typeColor={questionType.color}
                />
              ))}
            </Row>
          </div>
        )}
      </Col>
      <Col flex="154px">
        <Row className="flex-nowrap">
          <div className="flex w-[50px] flex-col items-center justify-center">
            <SpotIndicator
              aria-live="polite"
              aria-label={`Your ${
                question.isTaskQuestion ? 'demo' : 'question'
              } is ${toOrdinal(spot)}`}
            >
              {spot === 0 ? 'Now' : toOrdinal(spot)}
            </SpotIndicator>
            {spot > 0 ? <div className="leading-none">overall</div> : null}
          </div>
          {(() => {
            switch (question.status) {
              case 'Helping':
                return (
                  isQueueOnline &&
                  zoomLink && (
                    <Tooltip title="Open Zoom link">
                      <BannerButton
                        icon={<TeamOutlined />}
                        onClick={() => {
                          window.open(zoomLink)
                        }}
                      />
                    </Tooltip>
                  )
                )
              case 'Drafting':
                return (
                  <Tooltip title="Finish Draft">
                    {/* pulse animation */}
                    <div className="relative ml-2 inline-flex items-center justify-center">
                      <div className="absolute inset-0 animate-ping rounded-full bg-white opacity-50 before:content-['']"></div>
                      <BannerButton
                        className="!ml-0"
                        icon={<EditOutlined />}
                        onClick={edit}
                      />
                    </div>
                  </Tooltip>
                )
              case 'ReQueueing':
                return (
                  <Tooltip title="Rejoin Queue">
                    <Button
                      shape="circle"
                      style={{
                        marginLeft: '16px',
                        border: 0,
                      }}
                      icon={<UndoOutlined />}
                      onClick={async () => {
                        await API.questions.update(question.id, {
                          status: OpenQuestionStatus.Queued,
                        })
                      }}
                      type="primary"
                      size="large"
                    />
                  </Tooltip>
                )
              default:
                return <BannerButton icon={<EditOutlined />} onClick={edit} />
            }
          })()}

          {question.status === 'Drafting' ? (
            <Tooltip title="Delete Draft">
              <BannerButton icon={<DeleteRowOutlined />} onClick={leaveQueue} />
            </Tooltip>
          ) : (
            <LeaveQueueButton leaveQueue={leaveQueue} />
          )}
        </Row>
      </Col>
    </QuestionDetailCard>
  )
}
