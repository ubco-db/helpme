import { API } from '@koh/api-client'
import { Button } from 'antd'
import { useRouter } from 'next/navigation'
import { LoginOutlined, LogoutOutlined } from '@ant-design/icons'
import { useCourse } from '@/app/hooks/useCourse'
import { checkInTA } from '../utils/commonCourseFunctions'

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

  return (
    <>
      {state === 'CheckedIn' && (
        <Button
          type="default"
          size="large"
          disabled={disabled}
          onClick={async () => {
            onClick?.()
            if (preventDefaultAction) return
            await API.taStatus.checkOut(courseId, room)
            mutateCourse()
          }}
          className={`mb-3 flex items-center justify-center rounded-md text-sm font-semibold text-red-600 sm:mb-0 ${className}`}
          icon={<LogoutOutlined />}
        >
          Check Out
        </Button>
      )}
      {state === 'CheckedOut' && (
        <Button
          type="default"
          size="large"
          onClick={() => {
            onClick?.()
            if (preventDefaultAction) return
            checkInTA(courseId, room, mutateCourse, router)
          }}
          disabled={disabled || !course}
          className={`mb-3 flex items-center justify-center rounded-md bg-[#1890ff] text-sm font-semibold text-white sm:mb-0 ${className}`}
          icon={<LoginOutlined />}
        >
          Check In
        </Button>
      )}
    </>
  )
}

export default TACheckinButton
