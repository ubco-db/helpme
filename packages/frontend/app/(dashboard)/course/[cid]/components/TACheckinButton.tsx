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
  room: string // name of queue room to check into
  state: CheckInButtonState // State of the button
  preventDefaultAction?: boolean
  disabled?: boolean
  onClick?: () => void
  className?: string
}
const TACheckinButton: React.FC<TACheckinButtonProps> = ({
  courseId,
  room,
  state,
  preventDefaultAction,
  disabled = false,
  onClick,
  className,
}) => {
  const router = useRouter()
  const { course, mutateCourse } = useCourse(courseId)
  const [loading, setLoading] = useState(false)

  return (
    <>
      {state === 'CheckedIn' && (
        <Button
          type="default"
          size="large"
          disabled={disabled}
          loading={loading}
          onClick={async () => {
            onClick?.()
            if (preventDefaultAction) return
            setLoading(true)
            await API.taStatus
              .checkOut(courseId, room)
              .then(() => {
                mutateCourse()
                setLoading(false)
              })
              .catch((err) => {
                const errorMessage = getErrorMessage(err)
                message.error(errorMessage)
                setLoading(false)
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
          type="default"
          size="large"
          loading={loading}
          onClick={() => {
            onClick?.()
            if (preventDefaultAction) return
            setLoading(true)
            checkInTA(courseId, room, mutateCourse, router).then(() =>
              setLoading(false),
            )
          }}
          disabled={disabled || !course}
          className={`flex items-center justify-center rounded-md bg-[#1890ff] text-sm font-semibold text-white disabled:bg-opacity-30 disabled:text-gray-400 ${className}`}
          icon={<LoginOutlined />}
        >
          Check In
        </Button>
      )}
    </>
  )
}

export default TACheckinButton
