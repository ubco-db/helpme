import { OpenQuestionStatus, Question } from '@koh/common'
import { Badge, Button, Col, message, Popover, Row, Tooltip } from 'antd'
import { useQuestions } from '@/app/hooks/useQuestions'
import { useQueue } from '@/app/hooks/useQueue'
import UserAvatar from '@/app/components/UserAvatar'
import RenderEvery from '@/app/components/RenderEvery'
import { formatWaitTime } from '@/app/utils/timeFormatUtils'
import TextArea from 'antd/es/input/TextArea'
import { useState } from 'react'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { QuestionCircleOutlined } from '@ant-design/icons'

interface StaffListProps {
  queueId: number
  courseId: number
  isStaff: boolean
}
/**
 * Row of ta statuses
 */
const StaffList: React.FC<StaffListProps> = ({
  queueId,
  courseId,
  isStaff,
}) => {
  const { queueQuestions } = useQuestions(queueId)
  const { queue } = useQueue(queueId)
  const staffList = queue?.staffList ?? []
  if (!queueQuestions) {
    return null
  }

  const taToQuestions: Record<number, Question[]> = {}
  const taIds = staffList.map((t) => t.id)
  const helpingQuestions = queueQuestions.questionsGettingHelp
  const groups = queueQuestions.groups
  // for each TA, give them an array of questions that they are helping
  for (const question of helpingQuestions) {
    if (
      question.taHelped &&
      question.status !== OpenQuestionStatus.Paused &&
      taIds.includes(question.taHelped.id)
    ) {
      if (!taToQuestions[question.taHelped.id]) {
        taToQuestions[question.taHelped.id] = []
      }
      taToQuestions[question.taHelped.id].push(question)
    }
  }

  return (
    <Col className="my-1 flex flex-col gap-y-2 md:block">
      {staffList.map((ta) => (
        <Col key={ta.id}>
          <StatusCard
            courseId={courseId}
            isStaff
            taId={ta.id}
            taName={ta.name}
            taPhotoURL={ta.photoURL}
            studentName={
              taToQuestions[ta.id]?.length > 1
                ? `${taToQuestions[ta.id].length} students`
                : taToQuestions[ta.id]?.[0]?.creator?.name
            }
            taNotes={ta.TANotes}
            helpedAt={taToQuestions[ta.id]?.[0]?.helpedAt}
            grouped={groups.some((g) => g.creator.id === ta.id)}
          />
        </Col>
      ))}
    </Col>
  )
}

interface StatusCardProps {
  courseId: number
  isStaff: boolean
  taId: number
  taName?: string
  taPhotoURL?: string
  studentName?: string
  taNotes?: string
  helpedAt?: Date
  grouped?: boolean
}
/**
 * View component just renders TA status
 */
const StatusCard: React.FC<StatusCardProps> = ({
  courseId,
  isStaff,
  taId,
  taName,
  taPhotoURL,
  taNotes,
  studentName,
  helpedAt,
  grouped,
}) => {
  const isBusy = !!helpedAt
  const [tempTaNotes, setTempTaNotes] = useState<string | undefined>(taNotes)
  const [saveSuccessful, setSaveSuccessful] = useState(false)

  // TODO: instead of isStaff, need isProf
  return (
    <Popover
      mouseLeaveDelay={isStaff ? 0.5 : 0.1}
      overlayClassName="min-w-80"
      content={
        <div className="flex flex-col gap-y-2">
          {!isStaff ? (
            <div>{taNotes}</div>
          ) : (
            <>
              <TextArea
                placeholder="Add TA Notes..."
                autoSize={{ minRows: 4, maxRows: 7 }}
                value={tempTaNotes}
                onChange={(e) => setTempTaNotes(e.target.value)}
              />
              <div className="flex items-center justify-start">
                <Button
                  onClick={async () => {
                    await API.course
                      .updateTANotes(courseId, taId, tempTaNotes ?? '')
                      .then(() => {
                        setSaveSuccessful(true)
                        // saved goes away after 1s
                        setTimeout(() => {
                          setSaveSuccessful(false)
                        }, 1000)
                      })
                      .catch((e) => {
                        const errorMessage = getErrorMessage(e)
                        message.error(errorMessage)
                      })
                  }}
                >
                  Save
                </Button>
                <div>
                  {
                    <span
                      className={`ml-2 text-green-500 transition-opacity duration-300 ${
                        saveSuccessful ? 'opacity-100' : 'opacity-0'
                      }`}
                    >
                      Saved!
                    </span>
                  }
                </div>
              </div>
            </>
          )}
        </div>
      }
      title={
        <div className="flex items-center">
          <div>{taName} - TA Notes</div>
          <div>
            <Tooltip
              title={
                !isStaff
                  ? 'These are notes set by the professor on this TA.'
                  : "Here you can set notes on your TAs (e.g. a TA's schedule). Other users can then hover the TA to see these notes. You can also change these on the Roster page in Course Settings"
              }
            >
              <span className="ml-2 text-gray-500">
                <QuestionCircleOutlined />
              </span>
            </Tooltip>
          </div>
        </div>
      }
    >
      <div className="flex rounded-md bg-white p-3 shadow-md md:mb-4 md:p-4">
        <UserAvatar
          size={48}
          username={taName}
          photoURL={taPhotoURL}
          style={{ flexShrink: 0 }}
        />
        <div className="ml-4 flex-grow">
          <Row justify="space-between">
            <div className="font-bold text-gray-900">{taName}</div>
            <span>
              <Badge status={isBusy ? 'processing' : 'success'} />
              {isBusy ? 'Busy' : 'Available'}
            </span>
          </Row>
          <div className="mt-1 italic">
            {grouped ? (
              'Helping a group'
            ) : isBusy ? (
              <HelpingFor studentName={studentName} helpedAt={helpedAt} />
            ) : (
              'Looking for my next student...'
            )}
          </div>
        </div>
      </div>
    </Popover>
  )
}

interface HelpingForProps {
  studentName?: string
  helpedAt: Date
}
const HelpingFor: React.FC<HelpingForProps> = ({ studentName, helpedAt }) => {
  // A dirty fix until we can get the serializer working properly again (i renamed `questions` in SSEQueueResponse to `queueQuestions` and renamed `queue` in ListQuestionsResponse to `questions` and stuff broke for some reason)
  let tempDate = helpedAt
  if (typeof helpedAt === 'string') {
    tempDate = new Date(Date.parse(helpedAt))
  }
  return (
    <RenderEvery
      render={() => (
        <span>
          Helping{' '}
          <span className="text-blue-400">{studentName ?? 'a student'}</span>{' '}
          for{' '}
          <span className="text-blue-400">
            {formatWaitTime((Date.now() - tempDate.getTime()) / 60000)}
          </span>
        </span>
      )}
      interval={60 * 1000}
    />
  )
}

export { StaffList, StatusCard, HelpingFor }
export default StaffList
