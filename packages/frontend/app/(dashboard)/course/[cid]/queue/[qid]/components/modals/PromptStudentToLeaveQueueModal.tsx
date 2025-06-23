import { Button, message } from 'antd'
import Modal from 'antd/lib/modal/Modal'
import { useState } from 'react'
import { DoorOpen, PersonStanding } from 'lucide-react'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { ClosedQuestionStatus } from '@koh/common'
import Link from 'next/link'

type PromptStudentToLeaveQueueModalProps = {
  qid: number
  cid: number
  handleClose: () => Promise<void>
}
const PromptStudentToLeaveQueueModal: React.FC<
  PromptStudentToLeaveQueueModalProps
> = ({ qid, cid, handleClose }) => {
  const [isStayLoading, setIsStayLoading] = useState(false)
  const [isLeaveLoading, setIsLeaveLoading] = useState(false)
  const [modalJustOpened, setModalJustOpened] = useState(true)

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

  // after 1s, set modalJustOpened to false
  setTimeout(() => {
    setModalJustOpened(false)
  }, 1000)

  return (
    <Modal
      open={true}
      classNames={{
        footer: 'flex justify-center',
      }}
      footer={[
        <Button
          type="default"
          key="leave"
          onClick={async () => {
            setIsLeaveLoading(true)
            await closeAllQuestions()
            await handleClose()
            setIsLeaveLoading(false)
          }}
          loading={isLeaveLoading}
          disabled={isStayLoading || modalJustOpened}
          icon={<DoorOpen />}
          size="large"
          className="hover:border-red-500 hover:text-red-500"
        >
          Leave Queue
        </Button>,
        <Button
          type="default"
          key="stay"
          onClick={async () => {
            setIsStayLoading(true)
            await handleClose()
            setIsStayLoading(false)
          }}
          loading={isStayLoading}
          disabled={isLeaveLoading || modalJustOpened}
          icon={<PersonStanding />}
          size="large"
          className=""
        >
          I&apos;ll Stay, Thanks
        </Button>,
        <Link
          key="convert"
          className="btn btn-outline mx-2"
          href={{
            pathname: `/course/${cid}/async_centre`,
            query: { convertQueueQ: true, qid },
          }}
        >
          Convert&nbsp;to&nbsp;anytime&nbsp;question
        </Link>,
      ]}
      closable={false}
      destroyOnClose
    >
      <div className="flex flex-col items-center">
        <p className="text-lg">The last TA just checked out.</p>
        <p className="text-lg">Would you like to leave the queue or stay?</p>
      </div>
    </Modal>
  )
}
export default PromptStudentToLeaveQueueModal
