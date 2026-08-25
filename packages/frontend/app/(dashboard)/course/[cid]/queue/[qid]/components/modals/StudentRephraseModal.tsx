import { RephraseQuestionPayload } from '@koh/common'
import { Button } from 'antd'
import Modal from 'antd/lib/modal/Modal'

type StudentRephraseModalProps = {
  payload: RephraseQuestionPayload
  handleClose: () => void
  handleEdit: (courseId: number, queueId: number) => void
}
const StudentRephraseModal: React.FC<StudentRephraseModalProps> = ({
  payload,
  handleClose,
  handleEdit,
}) => {
  return (
    <Modal
      open={true}
      footer={[
        <Button type={'default'} key={'close'} onClick={() => handleClose()}>
          Dismiss
        </Button>,
        <Button
          type={'primary'}
          key={'continue'}
          onClick={() => handleEdit(payload.courseId, payload.queueId)}
        >
          Edit Question
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
