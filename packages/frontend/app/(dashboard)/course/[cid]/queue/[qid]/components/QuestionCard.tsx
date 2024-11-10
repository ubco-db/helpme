import {
  ConfigTasks,
  LimboQuestionStatus,
  OpenQuestionStatus,
  parseTaskIdsFromQuestionText,
  Question,
  QueueTypes,
  StudentAssignmentProgress,
} from '@koh/common'
import { Card, Col, Row, Tooltip } from 'antd'
import { useState, useEffect } from 'react'
import UserAvatar from '@/app/components/UserAvatar'
import TaskMarkingSelector from './TaskMarkingSelector'
import { QuestionTagElement } from '../../../components/QuestionTagElement'
import { getServedTime, getWaitTime } from '@/app/utils/timeFormatUtils'
import TAQuestionCardButtons from './TAQuestionCardButtons'
import { cn } from '@/app/utils/generalUtils'

interface QuestionCardProps {
  question: Question
  cid: number
  qid: number
  isStaff: boolean
  queueType: QueueTypes
  studentAssignmentProgress?: StudentAssignmentProgress
  configTasks?: ConfigTasks
  isMyQuestion?: boolean
  isBeingHelped?: boolean
  isBeingReQueued?: boolean
  isPaused?: boolean
  className?: string // used to highlight questions or add other classes
}

const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  cid,
  qid,
  isStaff,
  queueType,
  studentAssignmentProgress,
  configTasks,
  isMyQuestion,
  isBeingHelped,
  isBeingReQueued,
  isPaused,
  className,
}) => {
  const tasks = question.isTaskQuestion
    ? parseTaskIdsFromQuestionText(question.text)
    : [] // gives an array of "part1","part2",etc.
  const [tasksSelectedForMarking, setTasksSelectedForMarking] = useState<
    string[]
  >([])

  const onMarkingTaskChange = (selectedTaskIds: string[]) => {
    setTasksSelectedForMarking(selectedTaskIds)
  }

  const [servedTime, setServedTime] = useState(getServedTime(question))

  useEffect(() => {
    if (isBeingHelped && question.helpedAt && !isPaused) {
      const interval = setInterval(() => {
        setServedTime(getServedTime(question))
      }, 1000)
      return () => clearInterval(interval)
    } else if (isPaused) {
      setServedTime(getServedTime(question))
    }
  }, [isBeingHelped, question, isPaused])

  return (
    <Tooltip
      title={
        isBeingReQueued
          ? `${isMyQuestion ? 'You are' : 'This student is'} not quite ready to meet yet and ${isMyQuestion ? 'are' : 'is'} in the process of requeuing. Until ${isMyQuestion ? 'you' : 'they'} do, other students will be served first.`
          : isMyQuestion
            ? 'This is your question.'
            : ''
      }
    >
      <Card
        className={cn(
          'mb-2 rounded-md px-2 text-gray-600 shadow-md ',
          isBeingHelped ? 'mt-4 border border-green-600/40 md:mt-3 ' : '',
          isBeingHelped || isPaused ? 'mt-3 border md:mt-2' : '',
          isBeingHelped ? 'border-green-600/40 bg-green-50' : '',
          isPaused ? 'border-amber-600/40 bg-amber-50' : '',
          isMyQuestion ? 'bg-teal-100' : '',
          isMyQuestion && isBeingHelped
            ? 'bg-gradient-to-r from-teal-100 via-green-50 to-green-50'
            : '',
          isMyQuestion && isPaused
            ? 'bg-gradient-to-r from-teal-100 via-amber-50 to-amber-50'
            : '',
          isMyQuestion && !isBeingReQueued ? 'bg-teal-200/25' : 'bg-white',
          isBeingReQueued
            ? 'greyscale mt-3 border-gray-300 bg-gray-200/20 text-gray-400 md:mt-2'
            : ' ',
          className,
        )}
        classNames={{ body: 'px-0.5 py-1.5 md:px-2.5 md:py-2' }}
      >
        <Row className="items-center">
          {isStaff && ( // only show avatar if staff for now. TODO: fix endpoint to allow queues to access student avatars and names if prof enabled it
            <Col flex="0 1 auto" className="mr-2">
              <UserAvatar
                size={46}
                username={question.creator.name}
                photoURL={question.creator.photoURL}
                className={isBeingReQueued ? 'grayscale' : ''}
              />
            </Col>
          )}
          <Col flex="1 1">
            {question.status === 'Drafting' ? (
              <div className="text-base text-gray-400">
                {question.isTaskQuestion
                  ? 'Unfinished Demo'
                  : 'Unfinished Question'}
              </div>
            ) : // if it's a task question, parse the task items and display them instead of the question text
            question.isTaskQuestion && tasks && configTasks ? (
              <div>
                {
                  // if the task is being helped, display it as a TaskMarkingSelector (to allow professors to choose which parts are good)
                  question.status === OpenQuestionStatus.Helping ? (
                    <TaskMarkingSelector
                      onChange={onMarkingTaskChange}
                      tasksStudentWouldLikeMarked={tasks}
                      configTasks={configTasks}
                    />
                  ) : (
                    // for every task defined in the config, display it but only highlight the ones that are in the question text
                    Object.entries(configTasks).map(
                      ([taskKey, taskValue], index) => (
                        <QuestionTagElement
                          key={index}
                          tagName={
                            isMyQuestion &&
                            studentAssignmentProgress &&
                            studentAssignmentProgress[taskKey] &&
                            studentAssignmentProgress[taskKey].isDone
                              ? '✔️'
                              : taskValue.short_display_name
                          }
                          tagColor={
                            tasks.includes(taskKey)
                              ? taskValue.color_hex
                              : '#f0f0f0'
                          }
                        />
                      ),
                    )
                  )
                }
              </div>
            ) : (
              <>
                <Tooltip // only show tooltip if text is too long TODO: replace with expand card details feature
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
                        maxWidth: '55em',
                      } as React.CSSProperties
                    }
                  >
                    {question.text}
                  </div>
                </Tooltip>
              </>
            )}
            {isStaff && (
              <div
                className={cn(
                  'itali mr-1 mt-0.5 inline-block min-w-[120px] text-sm',
                  isBeingReQueued ? 'text-gray-400' : 'text-gray-600',
                )}
              >
                {queueType === 'hybrid' && (
                  <i>{`[${question.location ?? 'Unselected'}] `}</i>
                )}
                {question.creator.name}
              </div>
            )}

            {question.questionTypes?.map((questionType, index) => (
              <QuestionTagElement
                key={index}
                tagName={questionType.name}
                tagColor={!isBeingReQueued ? questionType.color : '#f0f0f0'}
              />
            ))}
          </Col>
          <Col flex={'0.1 1 auto'}>
            {(isBeingHelped || isPaused || isBeingReQueued) && !isStaff && (
              <Row justify={'end'}>
                <div
                  className={cn(
                    'text-sm',
                    isPaused ? 'text-amber-400' : '',
                    isBeingHelped ? 'text-green-700' : '',
                    isBeingReQueued ? 'italic' : '',
                  )}
                >
                  {isPaused && 'Currently Paused'}
                  {isBeingHelped && 'Being Served'}
                  {isBeingReQueued && 'Not Ready'}
                </div>
              </Row>
            )}
            <Row
              justify={'end'}
              className={cn(
                !isBeingHelped && !isPaused && !isBeingReQueued
                  ? 'h-[2.5rem]'
                  : '',
                'gap-1',
              )}
            >
              <Col flex="1 0 2rem">
                {isStaff && (
                  <div className="flex justify-end text-sm text-gray-600">
                    {getWaitTime(question)}
                  </div>
                )}
                {(isBeingHelped || isPaused) && (
                  <div
                    className={cn(
                      isBeingHelped ? 'text-green-700' : '',
                      isPaused ? 'text-amber-400' : '',
                      'font-md flex justify-end text-sm',
                    )}
                  >
                    {(isBeingHelped || isPaused) && servedTime}
                  </div>
                )}
              </Col>
              {!isStaff && (
                <Col flex="0 0 2rem">
                  <div className="flex justify-end text-nowrap text-sm text-gray-600">
                    {getWaitTime(question)}
                  </div>
                </Col>
              )}
            </Row>
          </Col>
          {isStaff &&
            (question.status !== LimboQuestionStatus.ReQueueing ? (
              <Col className="w-full sm:w-auto">
                <TAQuestionCardButtons
                  courseId={cid}
                  queueId={qid}
                  question={question}
                  hasUnresolvedRephraseAlert={false}
                  tasksSelectedForMarking={tasksSelectedForMarking}
                  className="align-center flex items-center justify-around"
                />
              </Col>
            ) : (
              <Col className="w-full sm:w-auto">
                <div className="text-md ml-0 h-full text-center italic text-gray-500 sm:ml-2">
                  Not Ready
                </div>
              </Col>
            ))}
        </Row>
      </Card>
    </Tooltip>
  )
}

export default QuestionCard
