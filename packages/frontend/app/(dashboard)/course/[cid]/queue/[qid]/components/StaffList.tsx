import {
  ExtraTAStatus,
  OpenQuestionStatus,
  Question,
  QueuePartial,
  Role,
  StaffMember,
} from '@koh/common'
import { Badge, Button, Col, message, Popover, Row, Tooltip } from 'antd'
import { useQuestions } from '@/app/hooks/useQuestions'
import UserAvatar from '@/app/components/UserAvatar'
import RenderEvery from '@/app/components/RenderEvery'
import { formatWaitTime } from '@/app/utils/timeFormatUtils'
import TextArea from 'antd/es/input/TextArea'
import { useState } from 'react'
import { API } from '@/app/api'
import { getErrorMessage, getRoleInCourse } from '@/app/utils/generalUtils'
import { QuestionCircleOutlined } from '@ant-design/icons'
import { useUserInfo } from '@/app/contexts/userContext'

interface StaffListProps {
  queue: QueuePartial
  queueId: number
  courseId: number
}
/**
 * Row of ta statuses
 */
const StaffList: React.FC<StaffListProps> = ({ queue, queueId, courseId }) => {
  const { queueQuestions } = useQuestions(queueId)
  const { userInfo } = useUserInfo()
  const role = getRoleInCourse(userInfo, courseId)

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
            myId={userInfo.id}
            myRole={role}
            courseId={courseId}
            ta={ta}
            studentName={
              taToQuestions[ta.id]?.length > 1
                ? `${taToQuestions[ta.id].length} students`
                : taToQuestions[ta.id]?.[0]?.creator?.name
            }
            helpedAt={
              taToQuestions[ta.id]?.[0]?.helpedAt ??
              ta.helpingStudentInAnotherQueueSince
            }
            grouped={groups.some((g) => g.creator.id === ta.id)}
          />
        </Col>
      ))}
    </Col>
  )
}

interface StatusCardProps {
  courseId: number
  ta: StaffMember
  myRole?: Role
  myId?: number
  studentName?: string
  helpedAt?: Date
  grouped?: boolean
}
/**
 * View component just renders TA status
 */
const StatusCard: React.FC<StatusCardProps> = ({
  courseId,
  ta,
  myRole,
  myId,
  studentName,
  helpedAt,
  grouped,
}) => {
  const isBusy = !!helpedAt || !!ta.extraStatus
  const [tempTaNotes, setTempTaNotes] = useState<string | undefined>(ta.TANotes)
  const [canSave, setCanSave] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveSuccessful, setSaveSuccessful] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)

  // you can edit the notes if it's you or if you're a professor
  const shouldShowEdit =
    myRole === Role.PROFESSOR || (myRole === Role.TA && myId === ta.id)

  // NOTE: if you modify this popover, you might also want to make changes to the popover on the courseRosterTable
  return (
    <Popover
      open={popoverOpen || canSave}
      destroyTooltipOnHide={false}
      onOpenChange={(open) => setPopoverOpen(open)}
      trigger={shouldShowEdit ? 'click' : 'hover'}
      mouseLeaveDelay={shouldShowEdit ? 0.5 : 0.1}
      overlayClassName="min-w-80"
      content={
        // if you can't edit it and the TA doesn't have notes, don't show anything
        !shouldShowEdit && !ta.TANotes ? null : (
          <div className="flex flex-col gap-y-2">
            {!shouldShowEdit ? (
              <div className="max-h-40 overflow-y-auto whitespace-pre-wrap">
                {ta.TANotes}
              </div>
            ) : (
              <>
                <TextArea
                  placeholder="Can answer questions about MATH 101, PHYS 102..."
                  autoSize={{ minRows: 4, maxRows: 7 }}
                  value={tempTaNotes}
                  onChange={(e) => {
                    setCanSave(e.target.value !== ta.TANotes)
                    setTempTaNotes(e.target.value)
                  }}
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center justify-start">
                    <Button
                      disabled={!canSave}
                      loading={saveLoading}
                      onClick={async () => {
                        setSaveLoading(true)
                        await API.course
                          .updateTANotes(courseId, ta.id, tempTaNotes ?? '')
                          .then(() => {
                            setSaveSuccessful(true)
                            setCanSave(false)
                            // saved goes away after 1s
                            setTimeout(() => {
                              setSaveSuccessful(false)
                            }, 1000)
                          })
                          .catch((e) => {
                            const errorMessage = getErrorMessage(e)
                            message.error(errorMessage)
                          })
                          .finally(() => {
                            setSaveLoading(false)
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
                  <Button
                    onClick={() => {
                      setTempTaNotes(ta.TANotes)
                      setCanSave(false)
                      setPopoverOpen(false)
                    }}
                    danger={canSave}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </div>
        )
      }
      title={
        // if you can't edit it and the TA doesn't have notes, don't show anything
        !shouldShowEdit && !ta.TANotes ? null : (
          <div className="flex items-center">
            <div>{ta.name} - TA Notes</div>
            <div>
              <Tooltip
                title={
                  myRole === Role.PROFESSOR
                    ? 'Here you can set notes on your TAs (e.g. the types of questions a TA can answer). Other users can then hover the TA to see these notes. You can also change these on the Roster page in Course Settings. TAs are able to modify their own notes.'
                    : myRole === Role.TA && myId === ta.id
                      ? 'Here you can give yourself notes that anyone can see if they hover you. For example, you could write the types of questions you can answer. Professors can also change these notes.'
                      : 'These are notes for this TA. They are written by them or set by the professor.'
                }
              >
                <span className="ml-2 text-gray-500">
                  <QuestionCircleOutlined />
                </span>
              </Tooltip>
            </div>
          </div>
        )
      }
    >
      <div
        className={`flex rounded-md bg-white p-3 shadow-md md:mb-4 md:p-4 ${shouldShowEdit ? 'cursor-pointer' : ''}`}
      >
        <UserAvatar
          size={48}
          username={ta.name}
          photoURL={ta.photoURL}
          style={{ flexShrink: 0 }}
        />
        <div className="ml-4 flex-grow">
          <Row justify="space-between">
            <div className="font-bold text-gray-900">{ta.name}</div>
            <span>
              <Badge status={isBusy ? 'processing' : 'success'} />
              {isBusy ? 'Busy' : 'Available'}
            </span>
          </Row>
          <div className="mt-1 italic">
            {grouped ? (
              'Helping a group'
            ) : isBusy && helpedAt ? (
              <HelpingFor
                studentName={studentName}
                helpedAt={helpedAt}
                extraTAStatus={ta.extraStatus}
              />
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
  extraTAStatus?: ExtraTAStatus
  helpedAt: Date
}
const HelpingFor: React.FC<HelpingForProps> = ({
  studentName,
  helpedAt,
  extraTAStatus,
}) => {
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
          {extraTAStatus === ExtraTAStatus.HELPING_IN_ANOTHER_COURSE ? (
            <span className="text-red-400">in another course </span>
          ) : extraTAStatus === ExtraTAStatus.HELPING_IN_ANOTHER_QUEUE ? (
            <span className="text-red-400">in another queue </span>
          ) : null}
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
