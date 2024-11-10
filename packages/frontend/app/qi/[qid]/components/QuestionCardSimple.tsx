import {
  ConfigTasks,
  parseTaskIdsFromQuestionText,
  Question,
} from '@koh/common'
import { Card, Col, Row, Tooltip } from 'antd'
import { getServedTime, getWaitTime } from '@/app/utils/timeFormatUtils'
import { QuestionTagElement } from '@/app/(dashboard)/course/[cid]/components/QuestionTagElement'
import { useState, useEffect } from 'react'
import { cn } from '@/app/utils/generalUtils'

interface QuestionCardSimpleProps {
  question: Question
  isBeingHelped?: boolean
  isPaused?: boolean
  configTasks?: ConfigTasks
  className?: string // used to highlight questions or add other classes
}

/**
 * This is very similar to the question card used in the queue, except with less functionality (no buttons, will never show avatars, etc.)
 */
const QuestionCardSimple: React.FC<QuestionCardSimpleProps> = ({
  question,
  isBeingHelped,
  isPaused,
  configTasks,
  className,
}) => {
  const tasks = question.isTaskQuestion
    ? parseTaskIdsFromQuestionText(question.text)
    : [] // gives an array of "part1","part2",etc.

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
    <Card
      className={cn(
        'my-1 w-full rounded-md bg-white px-2 text-gray-600 shadow-md ',
        isBeingHelped ? 'border' : '',
        isBeingHelped && !isPaused ? 'border-green-600/40 bg-green-50' : '',
        isPaused ? 'border-amber-600/40 bg-amber-50' : '',
        className,
      )}
      classNames={{ body: 'px-0.5 py-1.5 md:px-2.5 md:py-2' }}
    >
      <Row className="items-center">
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
                // for every task defined in the config, display it but only highlight the ones that are in the question text
                Object.entries(configTasks).map(
                  ([taskKey, taskValue], index) => (
                    <QuestionTagElement
                      key={index}
                      tagName={taskValue.short_display_name}
                      tagColor={
                        tasks.includes(taskKey)
                          ? taskValue.color_hex
                          : '#f0f0f0'
                      }
                    />
                  ),
                )
              }
            </div>
          ) : (
            <Tooltip // only show tooltip if text is too long TODO: replace with expand card details feature
              title={
                question.text && question.text.length > 110 ? question.text : ''
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
          )}
          {question.questionTypes?.map((questionType, index) => (
            <QuestionTagElement
              key={index}
              tagName={questionType.name}
              tagColor={questionType.color}
            />
          ))}
        </Col>
        <div>
          {(isBeingHelped || isPaused) && (
            <Row justify={'center'}>
              <div
                className={cn(
                  'text-sm',
                  isPaused ? 'text-amber-400' : '',
                  isBeingHelped ? 'text-green-700' : '',
                )}
              >
                {isPaused && 'Helping Paused'}
                {isBeingHelped && 'Being Served'}
              </div>
            </Row>
          )}
          <Row
            justify={'end'}
            className={cn(!isBeingHelped && !isPaused ? 'h-[2.5rem]' : '')}
          >
            <Col flex="0 0 2rem">
              {(isBeingHelped || isPaused) && (
                <div
                  className={cn(
                    isBeingHelped ? 'text-green-700' : '',
                    isPaused ? 'text-amber-400' : '',
                    'text-sm font-medium',
                  )}
                >
                  {(isBeingHelped || isPaused) && servedTime}
                </div>
              )}
            </Col>
            <Col flex="0 0 2rem">
              <div className="text-sm text-gray-600">
                {getWaitTime(question)}
              </div>
            </Col>
          </Row>
        </div>
      </Row>
    </Card>
  )
}

export default QuestionCardSimple
