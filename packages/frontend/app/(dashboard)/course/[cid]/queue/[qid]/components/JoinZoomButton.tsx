import { cn } from '@/app/utils/generalUtils'
import { Button, ButtonProps, Tooltip } from 'antd'
import { PhoneOutlined } from '@ant-design/icons'

interface JoinZoomButtonProps extends ButtonProps {
  mobileWidth: string
  zoomLink: string
}

const JoinZoomButton: React.FC<JoinZoomButtonProps> = ({
  type = 'primary',
  zoomLink,
  className,
  ...props
}): React.ReactElement => {
  return (
    <Tooltip title={"Join your instructor or TA's Zoom meeting."}>
      <Button
        size="large"
        className={cn(
          `mb-0 flex items-center justify-center rounded-md border border-gray-300 text-sm font-semibold disabled:opacity-50 md:mb-3 md:w-full`,
          className,
        )}
        onClick={() => window.open(zoomLink, '_blank')}
        type={type}
        aria-hidden="true"
        icon={<PhoneOutlined aria-hidden="true" />}
        {...props}
      >
        JOIN MEETING NOW
      </Button>
    </Tooltip>
  )
}

export default JoinZoomButton
