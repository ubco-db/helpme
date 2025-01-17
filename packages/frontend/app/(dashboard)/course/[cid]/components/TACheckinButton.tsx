import { Button, message } from 'antd'
import { useRouter } from 'next/navigation'
import { LoginOutlined, LogoutOutlined } from '@ant-design/icons'
import { useCourse } from '@/app/hooks/useCourse'
import { checkInTA } from '../utils/commonCourseFunctions'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { useState } from 'react'

type CheckInButtonState =
  | 'CheckedIn'
  | 'CheckedOut'
  | 'CheckedIntoOtherQueueAlready'

interface TACheckinButtonProps {
  courseId: number
  queueId?: number
  state: CheckInButtonState // State of the button
  preventDefaultAction?: boolean
  disabled?: boolean
  onClick?: () => void
  onSuccess?: () => void
  className?: string
}
const TACheckinButton: React.FC<TACheckinButtonProps> = ({
  courseId,
  queueId,
  state,
  preventDefaultAction,
  disabled = false,
  onClick,
  onSuccess,
  className,
}) => {
  const router = useRouter()
  const { course, mutateCourse } = useCourse(courseId)
  // This loading keeps track of if we're waiting for the server response
  const [loading, setLoading] = useState(false)
  // These loading states are to keep track if we're waiting for the frontend to update
  const [isSuccessfullyCheckedIn, setIsSuccessfullyCheckedIn] = useState(false)
  const [isSuccessfullyCheckedOut, setIsSuccessfullyCheckedOut] =
    useState(false)

  return (
    <>
      {state === 'CheckedIn' && (
        <Button
          type="default"
          size="large"
          disabled={disabled}
          loading={loading || isSuccessfullyCheckedOut}
          onClick={async () => {
            onClick?.()
            if (preventDefaultAction) return
            setLoading(true)
            await API.taStatus
              .checkMeOut(courseId, queueId)
              .then(() => {
                mutateCourse()
                setIsSuccessfullyCheckedOut(true)
                onSuccess?.()
              })
              .catch((err) => {
                const errorMessage = getErrorMessage(err)
                message.error(errorMessage)
              })
              .finally(() => {
                setLoading(false)
                setIsSuccessfullyCheckedIn(false)
              })
          }}
          className={`flex items-center justify-center rounded-md text-sm font-semibold text-red-600 hover:border-gray-300 hover:bg-gray-100 focus:bg-gray-100 disabled:text-gray-400 ${className}`}
          icon={<LogoutOutlined />}
        >
          Check Out
        </Button>
      )}
      {state === 'CheckedOut' && (
        <Button
          type="primary"
          size="large"
          loading={loading || isSuccessfullyCheckedIn}
          onClick={() => {
            onClick?.()
            if (preventDefaultAction) return
            if (!queueId) {
              message.error('Queue ID not found')
              return
            }
            setLoading(true)
            checkInTA(courseId, queueId, mutateCourse, router)
              .then(() => {
                setIsSuccessfullyCheckedIn(true)
                onSuccess?.()
              })
              .catch((err) => {
                const errorMessage = getErrorMessage(err)
                message.error(errorMessage)
              })
              .finally(() => {
                setLoading(false)
                setIsSuccessfullyCheckedOut(false)
              })
          }}
          disabled={disabled || !course}
          className={`flex items-center justify-center rounded-md font-semibold ${className}`}
          icon={<LoginOutlined />}
        >
          Check In
        </Button>
      )}
    </>
  )
}

export default TACheckinButton
