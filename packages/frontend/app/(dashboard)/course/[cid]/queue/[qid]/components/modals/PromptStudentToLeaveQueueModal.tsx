import { Button, message, Tooltip } from 'antd'
import Modal from 'antd/lib/modal/Modal'
import { useState, useEffect } from 'react'
import { ArrowRightLeft, DoorOpen, PersonStanding } from 'lucide-react'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { ClosedQuestionStatus } from '@koh/common'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

type PromptStudentToLeaveQueueModalProps = {
  qid: number
  cid: number
  questionId?: number
  handleClose: () => Promise<void>
}
const PromptStudentToLeaveQueueModal: React.FC<
  PromptStudentToLeaveQueueModalProps
> = ({ qid, cid, handleClose, questionId }) => {
  const [isStayLoading, setIsStayLoading] = useState(false)
  const [isLeaveLoading, setIsLeaveLoading] = useState(false)
  const [isConvertLoading, setIsConvertLoading] = useState(false)
  const [modalJustOpened, setModalJustOpened] = useState(true)
  const [queueQuestionId, setQueueQuestionId] = useState<number | null>(null)
  const [canConvert, setCanConvert] = useState(false)
  const [convertTooltip, setConvertTooltip] = useState(
    'Demos cannot be converted into anytime questions',
  )
  const pathname = usePathname()

  useEffect(() => {
    const fetchQuestionId = async () => {
      // if we have the question ID directly, use it:
      if (questionId) {
        setQueueQuestionId(questionId)
        setCanConvert(true)
        setConvertTooltip('')
        return
      }

      // else:
      const questions = await API.questions.index(qid)
      const myQuestions = questions.yourQuestions || []
      let myQuestion = null

      if (myQuestions.length === 1) {
        myQuestion = myQuestions[0]
        if (myQuestion.isTaskQuestion) {
          setCanConvert(false)
          setConvertTooltip('Demos cannot be converted into anytime questions')
        } else {
          setCanConvert(true)
          setConvertTooltip('')
        }
      } else if (myQuestions.length > 1) {
        myQuestion = myQuestions.find((q) => q.isTaskQuestion === false)
        setCanConvert(true)
        setConvertTooltip('')
      } else {
        setCanConvert(false)
        setConvertTooltip('No questions found')
      }

      if (myQuestion) {
        setQueueQuestionId(myQuestion.id)
      }
    }
    fetchQuestionId()
  }, [qid, questionId])

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

  // Reset loading states when component unmounts or becomes invisible
  useEffect(() => {
    return () => {
      setIsConvertLoading(false)
      setIsStayLoading(false)
      setIsLeaveLoading(false)
    }
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
        footer: 'flex justify-center gap-2 flex-wrap',
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
        <Link
          key="convert"
          href={{
            pathname: `/course/${cid}/async_centre`,
            query: {
              convertQueueQ: true,
              queueId: qid,
              queueQuestionId: queueQuestionId,
            },
          }}
        >
          <Tooltip title={convertTooltip}>
            <span>
              <Button
                type="default"
                key="convert"
                loading={isConvertLoading}
                disabled={
                  !canConvert ||
                  isLeaveLoading ||
                  isStayLoading ||
                  modalJustOpened ||
                  !queueQuestionId
                }
                icon={<ArrowRightLeft />}
                size="large"
              >
                Convert to anytime question
              </Button>
            </span>
          </Tooltip>
        </Link>,
      ]}
      closable={false}
      destroyOnHidden
    >
      <div className="flex flex-col items-center">
        <p className="text-lg">The last TA just checked out.</p>
        <p className="text-lg">Would you like to leave the queue or stay?</p>
      </div>
    </Modal>
  )
}
export default PromptStudentToLeaveQueueModal
