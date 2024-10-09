import { cn } from '@/app/utils/generalUtils'
import { Button, ButtonProps, Tooltip } from 'antd'
import { ClockCircleOutlined } from '@ant-design/icons'

interface ReQueuingButtonProps extends ButtonProps {
  setRequeuing: () => void
}

const ReQueuingButton: React.FC<ReQueuingButtonProps> = ({
  type = 'default',
  setRequeuing,
  className,
  ...props
}): React.ReactElement => {
  return (
    <Tooltip
      title={
        "If you're not ready to join the meeting and need more time, you can temporarily bump yourself out of the queue and rejoin whenever you're ready."
      }
    >
      <Button
        size="large"
        className={cn(
          `mb-0 flex items-center justify-center rounded-md border border-gray-300 text-sm font-semibold disabled:opacity-50 md:mb-3 md:w-full`,
          className,
        )}
        onClick={setRequeuing}
        type={type}
        icon={<ClockCircleOutlined aria-hidden="true" />}
        {...props}
      >
        Not Ready?
      </Button>
    </Tooltip>
  )
}

export default ReQueuingButton
