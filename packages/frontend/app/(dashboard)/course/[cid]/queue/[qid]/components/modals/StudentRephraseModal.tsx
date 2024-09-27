import { RephraseQuestionPayload } from '@koh/common'
import { Button } from 'antd'
import Modal from 'antd/lib/modal/Modal'

type StudentRephraseModalProps = {
  payload: RephraseQuestionPayload
  handleClose: (courseId: number, queueId: number) => void
}
const StudentRephraseModal: React.FC<StudentRephraseModalProps> = ({
  payload,
  handleClose,
}) => {
  return (
    <Modal
      open={true}
      footer={[
        <Button
          type={'primary'}
          key={'continue'}
          onClick={() => handleClose(payload.courseId, payload.queueId)}
        >
          Close
        </Button>,
      ]}
      closable={false}
    >
      You have been requested to add more detail to your question by a member of
      the course staff. While you elaborate on your question your place in line
      will be reserved.
    </Modal>
  )
}
export default StudentRephraseModal
