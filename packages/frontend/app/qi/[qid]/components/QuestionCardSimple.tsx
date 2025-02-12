import {
  ConfigTasks,
  parseTaskIdsFromQuestionText,
  Question,
} from '@koh/common'
import { Card, Col, Row } from 'antd'
import { getServedTime, getWaitTime } from '@/app/utils/timeFormatUtils'
import { QuestionTagElement } from '@/app/(dashboard)/course/[cid]/components/QuestionTagElement'
import { useState, useEffect } from 'react'
import { cn } from '@/app/utils/generalUtils'
import styles from '../../../(dashboard)/course/[cid]/queue/[qid]/components/QuestionCard.module.css'

interface QuestionCardSimpleProps {
  question: Question
  isBeingHelped?: boolean
  isPaused?: boolean
  isBeingReQueued?: boolean
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
  isBeingReQueued,
  configTasks,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [truncateText, setTruncateText] = useState(true) // after the max-height transition is finished on expanding the text, truncate it to show a `...`

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
        isBeingReQueued
          ? 'greyscale mt-3 border-gray-300 bg-gray-200/20 text-gray-400 md:mt-2'
          : '',
        className,
      )}
      classNames={{ body: 'px-0.5 py-1.5 md:px-2.5 md:py-2' }}
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
            <div
              className={cn(
                'childrenMarkdownFormatted',
                styles.expandableText,
                isExpanded ? styles.expanded : '',
                truncateText ? 'line-clamp-1' : '',
              )}
            >
              {question.text}
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
          {(isBeingHelped || isPaused || isBeingReQueued) && (
            <Row justify={'end'}>
              <div
                className={cn(
                  'text-sm',
                  isPaused ? 'mr-6 text-amber-400' : '',
                  isBeingHelped ? 'text-green-700' : '',
                  isBeingReQueued ? 'italic' : '',
                )}
              >
                {isPaused && 'Paused'}
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
              {(isBeingHelped || isPaused) && (
                <div
                  className={cn(
                    isBeingHelped ? 'text-green-700' : '',
                    isPaused ? 'text-amber-400' : '',
                    'flex justify-end text-sm font-medium',
                  )}
                >
                  {(isBeingHelped || isPaused) && servedTime}
                </div>
              )}
            </Col>
            <Col flex="0 0 2rem">
              <div className="flex justify-end text-nowrap text-sm text-gray-600">
                {getWaitTime(question)}
              </div>
            </Col>
          </Row>
        </Col>
      </Row>
    </Card>
  )
}

export default QuestionCardSimple
