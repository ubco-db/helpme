import { Button, message } from 'antd'
import Modal from 'antd/lib/modal/Modal'
import { useState, useEffect } from 'react'
import { ArrowRightLeft, DoorOpen, PersonStanding } from 'lucide-react'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { ClosedQuestionStatus } from '@koh/common'
import { useRouter } from 'next/navigation'
import { usePathname } from 'next/navigation'

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
  const [isConvertLoading, setIsConvertLoading] = useState(false)
  const [modalJustOpened, setModalJustOpened] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

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

  const handleConvertToAnytime = async () => {
    setIsConvertLoading(true)
    // Store loading state in localStorage so it can be reset when user comes back
    localStorage.setItem(`convertLoading_${cid}_${qid}`, 'true')
    // Don't close the modal/alert here - let it stay open in case they go back
    router.push(`/course/${cid}/async_centre?convertQueueQ=true&qid=${qid}`)
    // Don't reset loading state since we're navigating away
  }

  // Reset loading states when component unmounts or becomes invisible
  useEffect(() => {
    return () => {
      setIsConvertLoading(false)
      setIsStayLoading(false)
      setIsLeaveLoading(false)
    }
  }, [])

  // Reset convert loading state when component mounts (when user navigates back)
  useEffect(() => {
    setIsConvertLoading(false)
  }, [])

  // Check localStorage for loading state when component mounts
  useEffect(() => {
    const loadingKey = `convertLoading_${cid}_${qid}`
    const isConvertLoadingFromStorage = localStorage.getItem(loadingKey)
    if (isConvertLoadingFromStorage === 'true') {
      setIsConvertLoading(false)
      localStorage.removeItem(loadingKey)
    }
  }, [cid, qid])

  // Reset convert loading state when user navigates back to queue page
  useEffect(() => {
    if (pathname.includes(`/course/${cid}/queue/${qid}`)) {
      setIsConvertLoading(false)
    }
  }, [pathname, cid, qid])

  // after 1s, set modalJustOpened to false
  useEffect(() => {
    const timer = setTimeout(() => {
      setModalJustOpened(false)
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  return (
    <Modal
      open={true}
      width={650}
      classNames={{
        footer: 'flex justify-center gap-2',
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
          disabled={isStayLoading || isConvertLoading || modalJustOpened}
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
          disabled={isLeaveLoading || isConvertLoading || modalJustOpened}
          icon={<PersonStanding />}
          size="large"
          className=""
        >
          I&apos;ll Stay, Thanks
        </Button>,
        <Button
          type="default"
          key="convert"
          onClick={handleConvertToAnytime}
          loading={isConvertLoading}
          disabled={isLeaveLoading || isStayLoading || modalJustOpened}
          icon={<ArrowRightLeft />}
          size="large"
        >
          Convert to anytime question
        </Button>,
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
