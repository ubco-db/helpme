import { LimboQuestionStatus, Question } from '@koh/common'
import { Button } from 'antd'
import Modal from 'antd/lib/modal/Modal'

type StudentRemovedFromQueueModalProps = {
  question: Question | undefined
  leaveQueue: () => void
  joinQueue: () => void
}

const StudentRemovedFromQueueModal: React.FC<
  StudentRemovedFromQueueModalProps
> = ({ question, leaveQueue, joinQueue }) => {
  return (
    <Modal
      open={question?.status === LimboQuestionStatus.TADeleted}
      footer={[
        <Button key="leave" danger onClick={leaveQueue}>
          Leave Queue
        </Button>,
        <Button type="primary" key="rejoin" onClick={joinQueue}>
          Rejoin Queue
        </Button>,
      ]}
      closable={false}
    >
      You&apos;ve been removed from the queue by a TA. If you have any
      questions, please reach out to the TA. If you&apos;d like to join back
      into the queue with your previous question, click Rejoin Queue, otherwise
      click Leave Queue.
    </Modal>
  )
}

export default StudentRemovedFromQueueModal
