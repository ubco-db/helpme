import {
  ConfigTasks,
  parseTaskIdsFromQuestionText,
  Question,
} from '@koh/common'
import { Card, Col, Row, Tooltip } from 'antd'
import { getWaitTime } from '@/app/utils/timeFormatUtils'
import { QuestionTagElement } from '@/app/(dashboard)/course/[cid]/components/QuestionTagElement'

interface QuestionCardSimpleProps {
  question: Question
  isBeingHelped?: boolean
  configTasks?: ConfigTasks
  className?: string // used to highlight questions or add other classes
}

const QuestionCardSimple: React.FC<QuestionCardSimpleProps> = ({
  question,
  isBeingHelped,
  configTasks,
  className,
}) => {
  const tasks = question.isTaskQuestion
    ? parseTaskIdsFromQuestionText(question.text)
    : [] // gives an array of "part1","part2",etc.

  return (
    <Card
      className={`mb-2 w-full rounded-md bg-white px-2 text-gray-600 shadow-md ${className}`}
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
                // if the task is being helped, display it as a TaskMarkingSelector (to allow professors to choose which parts are good)

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
          {/* {isStaff && (
                        <div className="mr-1 mt-0.5 inline-block min-w-[120px] text-sm italic text-gray-600">
                            {question.creator.name}
                        </div>
                    )} */}
          {question.questionTypes?.map((questionType, index) => (
            <QuestionTagElement
              key={index}
              tagName={questionType.name}
              tagColor={questionType.color}
            />
          ))}
        </Col>
        <Col flex="0 0 3rem">
          <div className="text-sm text-gray-600">{getWaitTime(question)}</div>
        </Col>
        <div className="absolute">
          {isBeingHelped && (
            <div className="text-sm text-green-600">Being helped</div>
          )}
        </div>
      </Row>
    </Card>
  )
}

export default QuestionCardSimple
