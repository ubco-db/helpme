import { OpenQuestionStatus, Question } from '@koh/common'
import { Badge, Col, Row } from 'antd'
import { useQuestions } from '@/app/hooks/useQuestions'
import { useQueue } from '@/app/hooks/useQueue'
import UserAvatar from '@/app/components/UserAvatar'
import RenderEvery from '@/app/components/RenderEvery'
import { formatWaitTime } from '@/app/utils/timeFormatUtils'

interface StaffListProps {
  queueId: number
}
/**
 * Row of ta statuses
 */
const StaffList: React.FC<StaffListProps> = ({ queueId }) => {
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
            taName={ta.name}
            taPhotoURL={ta.photoURL}
            studentName={
              taToQuestions[ta.id]?.length > 1
                ? `${taToQuestions[ta.id].length} students`
                : taToQuestions[ta.id]?.[0]?.creator?.name
            }
            helpedAt={taToQuestions[ta.id]?.[0]?.helpedAt}
            grouped={groups.some((g) => g.creator.id === ta.id)}
          />
        </Col>
      ))}
    </Col>
  )
}

interface StatusCardProps {
  taName?: string
  taPhotoURL?: string
  studentName?: string
  helpedAt?: Date
  grouped?: boolean
}
/**
 * View component just renders TA status
 */
const StatusCard: React.FC<StatusCardProps> = ({
  taName,
  taPhotoURL,
  studentName,
  helpedAt,
  grouped,
}) => {
  const isBusy = !!helpedAt
  return (
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
