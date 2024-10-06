import { AlertType, RephraseQuestionPayload } from '@koh/common'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import StudentRephraseModal from '../(dashboard)/course/[cid]/queue/[qid]/components/modals/StudentRephraseModal'
import { API } from '../api'

type AlertsContainerProps = {
  courseId: number
}
const AlertsContainer: React.FC<AlertsContainerProps> = ({ courseId }) => {
  const router = useRouter()
  const { data, mutate: mutateAlerts } = useSWR('/api/v1/alerts', async () =>
    API.alerts.get(courseId),
  )
  const alerts = data?.alerts

  const handleClose = async (
    alertId: number,
    courseId: number,
    queueId: number,
  ) => {
    await API.alerts.close(alertId)

    await mutateAlerts()
    router.push(`/course/${courseId}/queue/${queueId}?edit_question=true`)
  }

  const alertDivs = alerts?.map((alert) => {
    switch (alert.alertType) {
      case AlertType.REPHRASE_QUESTION:
        return (
          <StudentRephraseModal
            payload={alert.payload as RephraseQuestionPayload}
            handleClose={async (courseId, queueId) =>
              await handleClose(alert.id, courseId, queueId)
            }
          />
        )
    }
  })

  // probably want some better way of handling multiple alerts
  return <div>{alertDivs}</div>
}

export default AlertsContainer
