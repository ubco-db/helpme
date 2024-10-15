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
    if (isBeingHelped && question.helpedAt) {
      const interval = setInterval(() => {
        setServedTime(getServedTime(question))
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [isBeingHelped, question])

  return (
    <Tooltip
      title={
        question.status === LimboQuestionStatus.ReQueueing
          ? ' This student is not quite ready to meet yet and is in the process of requeuing themselves. Until they do, other students will be served first.'
          : ''
      }
    >
      <Card
        className={cn(
          'mb-2 rounded-md px-2 text-gray-600 shadow-md ',
          isBeingHelped ? 'mt-4 border border-green-600/40 md:mt-3 ' : ' ',
          question.status === LimboQuestionStatus.ReQueueing
            ? 'greyscale mt-3 border border-gray-200 text-gray-400 md:mt-2'
            : ' ',
          isMyQuestion && question.status === LimboQuestionStatus.ReQueueing
            ? 'bg-teal-200/10'
            : isMyQuestion
              ? 'bg-teal-200/25'
              : question.status === LimboQuestionStatus.ReQueueing
                ? 'bg-white/15'
                : 'bg-white',
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
                className={
                  question.status === LimboQuestionStatus.ReQueueing
                    ? 'grayscale'
                    : ''
                }
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
                    {`${question.text}`}
                  </div>
                </Tooltip>
              </>
            )}
            {isStaff && (
              <div
                className={cn(
                  'itali mr-1 mt-0.5 inline-block min-w-[120px] text-sm',
                  question.status === LimboQuestionStatus.ReQueueing
                    ? 'text-gray-400'
                    : 'text-gray-600',
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
                tagColor={
                  question.status !== LimboQuestionStatus.ReQueueing
                    ? questionType.color
                    : '#f0f0f0'
                }
              />
            ))}
          </Col>
          {isBeingHelped && !isStaff && question.helpedAt && (
            <Col flex="0 0 3rem">
              <div className="text-sm font-medium text-green-700">
                {servedTime}
              </div>
            </Col>
          )}
          <Col flex="0 0 3rem">
            <div className="text-sm text-gray-600">{getWaitTime(question)}</div>
            {isStaff && isBeingHelped && (
              <div className="text-sm font-medium text-green-700">
                {servedTime}
              </div>
            )}
          </Col>
          {question.status !== LimboQuestionStatus.ReQueueing ? (
            isStaff ? (
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
            ) : null
          ) : (
            <Col className="w-full sm:w-auto">
              <div className="text-md ml-0 h-full italic text-gray-600 sm:ml-2">
                In the process of requeuing...
              </div>
            </Col>
          )}
          <div
            className={`absolute left-auto right-1 ${question.text && question.questionTypes && question.questionTypes.length > 0 ? '-mt-[5.4rem]' : '-mt-12 md:-mt-[3.2rem]'}`}
          >
            {isBeingHelped && !isStaff && (
              <div className="text-sm text-green-700">
                Currently Being Served
              </div>
            )}
          </div>
        </Row>
      </Card>
    </Tooltip>
  )
}

export default QuestionCard
