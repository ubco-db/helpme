import { Button, message } from 'antd'
import Modal from 'antd/lib/modal/Modal'
import { useState } from 'react'
import { DoorOpen, PersonStanding } from 'lucide-react'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { ClosedQuestionStatus } from '@koh/common'

type PromptStudentToLeaveQueueModalProps = {
  qid: number
  handleClose: () => Promise<void>
}
const PromptStudentToLeaveQueueModal: React.FC<
  PromptStudentToLeaveQueueModalProps
> = ({ qid, handleClose }) => {
  // TODO: disable buttons for 1s upon the modal loading
  const [isStayLoading, setIsStayLoading] = useState(false)
  const [isLeaveLoading, setIsLeaveLoading] = useState(false)

  const closeAllQuestions = async () => {
    const questions = await API.questions.index(qid)
    const myQuestions = questions.yourQuestions
    if (!myQuestions) {
      message.info("You don't seem to have any open questions.", 4)
      return
    }
    for (const question of myQuestions) {
      await API.questions
        .update(question.id, { status: ClosedQuestionStatus.ConfirmedDeleted })
        .catch((e) => {
          const errorMessage = getErrorMessage(e)
          message.error(errorMessage)
        })
    }
  }

  return (
    <Modal
      open={true}
      classNames={{
        footer: 'flex justify-center',
      }}
      footer={[
        <Button
          type={'default'}
          key={'leave'}
          onClick={async () => {
            setIsLeaveLoading(true)
            await closeAllQuestions()
            await handleClose()
            setIsLeaveLoading(false)
          }}
          loading={isLeaveLoading}
          disabled={isStayLoading}
          icon={<DoorOpen />}
          size="large"
          className="hover:border-red-500 hover:text-red-500"
        >
          Leave Queue
        </Button>,
        <Button
          type={'default'}
          key={'stay'}
          onClick={async () => {
            setIsStayLoading(true)
            await handleClose()
            setIsStayLoading(false)
          }}
          loading={isStayLoading}
          disabled={isLeaveLoading}
          icon={<PersonStanding />}
          size="large"
          className=""
        >
          I&apos;ll Stay Thanks
        </Button>,
      ]}
      closable={false}
    >
      <div className="flex flex-col items-center">
        <p className="text-lg">The last TA just checked out.</p>
        <p className="text-lg">Would you like to leave the queue or stay?</p>
      </div>
    </Modal>
  )
}
export default PromptStudentToLeaveQueueModal
