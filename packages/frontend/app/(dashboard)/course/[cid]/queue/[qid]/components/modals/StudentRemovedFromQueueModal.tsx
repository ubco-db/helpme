import { LimboQuestionStatus, Question } from '@koh/common'
import { Button } from 'antd'
import Modal from 'antd/lib/modal/Modal'
import { DoorOpen, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'

type StudentRemovedFromQueueModalProps = {
  question: Question | undefined
  leaveQueue: () => Promise<void>
  joinQueue: () => Promise<void>
}

const StudentRemovedFromQueueModal: React.FC<
  StudentRemovedFromQueueModalProps
> = ({ question, leaveQueue, joinQueue }) => {
  const [isLeaveLoading, setIsLeaveLoading] = useState(false)
  const [isRejoinLoading, setIsRejoinLoading] = useState(false)
  const [modalJustOpened, setModalJustOpened] = useState(true)
  setTimeout(() => {
    setModalJustOpened(false)
  }, 1000)
  useEffect(() => {
    if (question?.status === LimboQuestionStatus.TADeleted) {
      setModalJustOpened(true)
      setTimeout(() => {
        setModalJustOpened(false)
      }, 1000)
    }
  }, [question])
  return (
    <Modal
      open={question?.status === LimboQuestionStatus.TADeleted}
      classNames={{
        footer: 'flex justify-center',
      }}
      footer={[
        <Button
          type="default"
          key="leave"
          onClick={async () => {
            setIsLeaveLoading(true)
            await leaveQueue()
            setIsLeaveLoading(false)
          }}
          loading={isLeaveLoading}
          disabled={modalJustOpened}
          icon={<DoorOpen />}
          size="large"
          className="hover:border-green-500 hover:text-green-500"
        >
          I&apos;m Okay, Thanks
        </Button>,
        <Button
          type="default"
          key="rejoin"
          onClick={async () => {
            setIsRejoinLoading(true)
            await joinQueue()
            setIsRejoinLoading(false)
          }}
          loading={isRejoinLoading}
          disabled={modalJustOpened}
          icon={<RotateCcw />}
          size="large"
          className=""
        >
          Rejoin
        </Button>,
      ]}
      closable={false}
      destroyOnHidden
    >
      <div className="flex flex-col items-center">
        <p className="text-lg">
          Your question has been removed from the queue by a TA.
        </p>
        <p className="text-lg">
          Would you like to rejoin the queue with your old question?
        </p>
      </div>
    </Modal>
  )
}

export default StudentRemovedFromQueueModal
