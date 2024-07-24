import { Question } from '@koh/common'
import { Badge, Col, Row } from 'antd'
import { useQuestions } from '@/app/hooks/useQuestions'
import { useQueue } from '@/app/hooks/useQueue'
import UserAvatar from '@/app/components/UserAvatar'
import RenderEvery from '@/app/components/RenderEvery'
import { formatWaitTime } from '@/app/utils/timeFormatUtils'

interface TAStatusListProps {
  queueId: number
}
/**
 * Row of ta statuses
 */
const TAStatusList: React.FC<TAStatusListProps> = ({ queueId }) => {
  const { queueQuestions } = useQuestions(queueId)
  const {
    queue: { staffList },
  } = useQueue(queueId)
  if (!queueQuestions) {
    return null
  }

  const taToQuestion: Record<number, Question> = {}
  const taIds = staffList.map((t) => t.id)
  const helpingQuestions = queueQuestions.questionsGettingHelp
  const groups = queueQuestions.groups
  for (const question of helpingQuestions) {
    if (question.taHelped && taIds.includes(question.taHelped.id)) {
      taToQuestion[question.taHelped.id] = question
    }
  }

  return (
    <Col className="mb-3 sm:mb-0">
      {staffList.map((ta) => (
        <Col key={ta.id}>
          <StatusCard
            taName={ta.name}
            taPhotoURL={ta.photoURL}
            studentName={taToQuestion[ta.id]?.creator?.name}
            helpedAt={taToQuestion[ta.id]?.helpedAt}
            grouped={groups.some((g) => g.creator.id === ta.id)}
          />
        </Col>
      ))}
    </Col>
  )
}

interface StatusCardProps {
  taName: string
  taPhotoURL: string
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
    <div className="mb-4 flex rounded-md bg-white p-3 shadow-md md:mb-4 md:p-4">
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
  return (
    <RenderEvery
      render={() => (
        <span>
          Helping{' '}
          <span className="text-blue-400">{studentName ?? 'a student'}</span>{' '}
          for{' '}
          <span className="text-blue-400">
            {formatWaitTime((Date.now() - helpedAt.getTime()) / 60000)}
          </span>
        </span>
      )}
      interval={60 * 1000}
    />
  )
}

export default TAStatusList
