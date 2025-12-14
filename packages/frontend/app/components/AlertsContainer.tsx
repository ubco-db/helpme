import {
  AlertType,
  PromptStudentToLeaveQueuePayload,
  RephraseQuestionPayload,
} from '@koh/common'
import { useRouter } from 'next/navigation'
import StudentRephraseModal from '../(dashboard)/course/[cid]/queue/[qid]/components/modals/StudentRephraseModal'
import { API } from '../api'
import { useAlertsContext } from '@/app/contexts/alertsContext'
import EventEndedCheckoutStaffModal from '../(dashboard)/course/[cid]/queue/[qid]/components/modals/EventEndedCheckoutStaffModal'
import PromptStudentToLeaveQueueModal from '../(dashboard)/course/[cid]/queue/[qid]/components/modals/PromptStudentToLeaveQueueModal'

type AlertsContainerProps = {
  courseId: number
}
const AlertsContainer: React.FC<AlertsContainerProps> = ({ courseId }) => {
  const router = useRouter()
  const { thisCourseAlerts, closeCourseAlert } = useAlertsContext()
  const alerts = thisCourseAlerts

  const handleCloseRephrase = async (
    alertId: number,
    courseId: number,
    queueId: number,
  ) => {
    await closeCourseAlert(alertId)
    router.push(`/course/${courseId}/queue/${queueId}?edit_question=true`)
  }

  const alertDivs = alerts?.map((alert) => {
    switch (alert.alertType) {
      case AlertType.REPHRASE_QUESTION:
        return (
          <StudentRephraseModal
            payload={alert.payload as RephraseQuestionPayload}
            handleClose={async (courseId, queueId) =>
              await handleCloseRephrase(alert.id, courseId, queueId)
            }
          />
        )
      case AlertType.EVENT_ENDED_CHECKOUT_STAFF:
        return (
          <EventEndedCheckoutStaffModal
            courseId={courseId}
            handleClose={async () => {
              await closeCourseAlert(alert.id)
            }}
          />
        )
      case AlertType.PROMPT_STUDENT_TO_LEAVE_QUEUE:
        return (
          <PromptStudentToLeaveQueueModal
            key={alert.id}
            qid={(alert.payload as PromptStudentToLeaveQueuePayload).queueId}
            cid={courseId}
            questionId={
              (alert.payload as PromptStudentToLeaveQueuePayload)
                .queueQuestionId
            }
            handleClose={async () => {
              await closeCourseAlert(alert.id)
            }}
          />
        )
    }
  })

  // probably want some better way of handling multiple alerts
  return <div>{alertDivs}</div>
}

export default AlertsContainer
