'use client'

import {
  DeleteRowOutlined,
  EditOutlined,
  TeamOutlined,
  UndoOutlined,
} from '@ant-design/icons'
import {
  ConfigTasks,
  OpenQuestionStatus,
  parseTaskIdsFromQuestionText,
  Question,
} from '@koh/common'
import { Col, message, Popconfirm, Row, Tooltip } from 'antd'
import { QuestionTagElement } from '../../../components/QuestionTagElement'
import { cn, getErrorMessage, toOrdinal } from '@/app/utils/generalUtils'
import { API } from '@/app/api'
import { useStudentQuestion } from '@/app/hooks/useStudentQuestion'
import CircleButton from './CircleButton'
import { useState } from 'react'

interface StudentBannerProps {
  queueId: number
  editQuestion: () => void
  editDemo: () => void
  leaveQueueQuestion: () => Promise<void>
  leaveQueueDemo: () => Promise<void>
  configTasks: ConfigTasks | undefined
  zoomLink: string | undefined
  isQueueOnline: boolean | undefined
}
const StudentBanner: React.FC<StudentBannerProps> = ({
  queueId,
  editQuestion,
  editDemo,
  leaveQueueQuestion,
  leaveQueueDemo,
  configTasks,
  zoomLink,
  isQueueOnline,
}) => {
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
          studentQuestion?.taHelped?.name ?? 'A TA'
        } is ready for you now`
      case 'ReQueueing':
        return 'Your Questions - Are you ready to re-join the queue?'
      case 'PriorityQueued':
        return (
          'Your Questions - You are now in a priority queue, you will be helped soon. Last helped by: ' +
          studentQuestion?.taHelped?.name
        )
      case 'Paused':
        return `Your Questions - Your question is currently paused, you will be helped later.`
      default:
        switch (demoStatus) {
          case 'Drafting':
            return 'Your Questions - Please finish creating your demo'
          case 'Helping':
            return `Your Questions - ${
              studentDemo?.taHelped?.name ?? 'A TA'
            } is coming to check your demo`
          case 'ReQueueing':
            return 'Your Questions - Are you ready to re-join the queue?'
          case 'PriorityQueued':
            return (
              'Your Questions - You are now in a priority queue, you will be helped soon.  Last helped by: ' +
              studentQuestion?.taHelped?.name
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
    <div className="mb-1 w-full md:mb-2">
      <div className="bg-helpmeblue  relative flex min-h-[3rem] items-center justify-between rounded-t-md pl-4 pr-1.5 shadow-md md:min-h-14 md:pl-6">
        <div className="text-xl text-white md:text-2xl">
          {getTitle(studentQuestion?.status, studentDemo?.status)}
        </div>
      </div>
      <div className="rounded-b-md bg-[#ABD4F3] px-2 py-4 md:p-[0.4rem]">
        <QuestionDetailCard
          question={studentQuestion}
          spot={
            studentQuestionIndex === undefined
              ? undefined
              : studentQuestionIndex + 1
          }
          isQueueOnline={!!isQueueOnline}
          zoomLink={zoomLink}
          leaveQueue={leaveQueueQuestion}
          edit={editQuestion}
        />
        {studentQuestion?.status === 'Helping' && (
          <div>
            Be respectful of the TA’s time. Be prepared with your question!
          </div>
        )}
        <QuestionDetailCard
          question={studentDemo}
          configTasks={configTasks}
          spot={
            studentDemoIndex === undefined ? undefined : studentDemoIndex + 1
          }
          isQueueOnline={!!isQueueOnline}
          zoomLink={zoomLink}
          leaveQueue={leaveQueueDemo}
          edit={editDemo}
        />
        {studentDemo?.status === 'Helping' && (
          <div>Be respectful of the TA’s time. Be prepared with your demo!</div>
        )}
      </div>
    </div>
  )
}

function LeaveQueueButton({ leaveQueue }: { leaveQueue: () => Promise<void> }) {
  const [isLeavingLoading, setIsLeavingLoading] = useState(false)
  return (
    <Popconfirm
      title={`Are you sure you want to leave the queue?`}
      okText="Yes"
      cancelText="No"
      okButtonProps={{ loading: isLeavingLoading }}
      onConfirm={() => {
        setIsLeavingLoading(true)
        leaveQueue().finally(() => setIsLeavingLoading(false))
      }}
    >
      <Tooltip title="Leave Queue">
        <CircleButton
          variant="red"
          icon={<DeleteRowOutlined />}
          loading={isLeavingLoading}
        />
      </Tooltip>
    </Popconfirm>
  )
}

interface QuestionDetailCardProps {
  question: Question | undefined
  configTasks?: ConfigTasks
  spot: number | undefined
  isQueueOnline: boolean
  zoomLink: string | undefined
  leaveQueue: () => Promise<void>
  edit: () => void
}

const QuestionDetailCard: React.FC<QuestionDetailCardProps> = ({
  question,
  configTasks,
  spot,
  isQueueOnline,
  zoomLink,
  leaveQueue,
  edit,
}) => {
  const [isRejoinLoading, setIsRejoinLoading] = useState(false)
  const [isDeleteDraftLoading, setIsDeleteDraftLoading] = useState(false)
  if (!question) {
    return <></>
  }
  const tasks = question.isTaskQuestion
    ? parseTaskIdsFromQuestionText(question.text)
    : []

  const getStatusBorderColor = (status: string) => {
    switch (status) {
      case 'Drafting':
        return 'border-[#faad14]'
      case 'Helping':
        return 'border-[#4dc186]'
      case 'Paused':
        return 'border-amber-200'
      case 'ReQueueing':
        return 'border-[#66BB6A]'
      case 'PriorityQueued':
        return 'border-helpmeblue'
      default:
        return 'border-none'
    }
  }

  return (
    <div
      className={cn(
        'flex min-h-[63px] rounded border-4 border-dashed bg-[#599cd6] p-[0.4rem] text-white md:m-2 md:mx-[0.4rem] md:p-2',
        getStatusBorderColor(question.status),
      )}
    >
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
                <QuestionTagElement
                  key={index}
                  tagName={taskValue.display_name}
                  tagColor={taskValue.color_hex}
                />
              )
            })}
          </div>
        ) : (
          <div>
            <Row>
              <Tooltip // only show tooltip if text is too long
                title={
                  question.text && question.text.length > 110
                    ? question.text
                    : ''
                }
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
                <QuestionTagElement
                  key={index}
                  tagName={questionType.name}
                  tagColor={questionType.color}
                />
              ))}
            </Row>
          </div>
        )}
      </Col>
      <Col flex="154px" className="flex items-center justify-center">
        <Row className="flex-nowrap">
          {spot !== undefined && (
            <div className="flex w-[50px] flex-col items-center justify-center">
              <div
                className="text-2xl font-bold leading-none"
                aria-live="polite"
                aria-label={`Your ${
                  question.isTaskQuestion ? 'demo' : 'question'
                } is ${toOrdinal(spot)}`}
              >
                {spot === 0 ? 'Now' : toOrdinal(spot)}
              </div>
              {spot > 0 ? <div className="leading-none">overall</div> : null}
            </div>
          )}
          {(() => {
            switch (question.status) {
              case 'Helping':
                return (
                  isQueueOnline &&
                  zoomLink && (
                    <Tooltip title="Open Zoom link">
                      <CircleButton
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
                      <CircleButton
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
                    <CircleButton
                      variant="primary"
                      icon={<UndoOutlined />}
                      loading={isRejoinLoading}
                      onClick={async () => {
                        setIsRejoinLoading(true)
                        await API.questions
                          .update(question.id, {
                            status: OpenQuestionStatus.Queued,
                          })
                          .catch((e) => {
                            const errorMessage = getErrorMessage(e)
                            message.error(errorMessage)
                          })
                          .finally(() => setIsRejoinLoading(false))
                      }}
                    />
                  </Tooltip>
                )
              default:
                return (
                  <Tooltip
                    title={`Edit ${question.isTaskQuestion ? 'Demo' : 'Question'}`}
                  >
                    <CircleButton icon={<EditOutlined />} onClick={edit} />
                  </Tooltip>
                )
            }
          })()}

          {question.status === 'Drafting' ? (
            <Tooltip title="Delete Draft">
              <CircleButton
                icon={<DeleteRowOutlined />}
                loading={isDeleteDraftLoading}
                onClick={() => {
                  setIsDeleteDraftLoading(true)
                  leaveQueue().finally(() => setIsDeleteDraftLoading(false))
                }}
              />
            </Tooltip>
          ) : (
            <LeaveQueueButton leaveQueue={leaveQueue} />
          )}
        </Row>
      </Col>
    </div>
  )
}

export default StudentBanner
