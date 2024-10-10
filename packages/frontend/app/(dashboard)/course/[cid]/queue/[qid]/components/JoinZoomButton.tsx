import { cn } from '@/app/utils/generalUtils'
import { Button, ButtonProps, Tooltip } from 'antd'
import { PhoneOutlined } from '@ant-design/icons'
import { PropsWithChildren } from 'react'

interface JoinZoomButtonProps extends ButtonProps {
  zoomLink?: string
  onJoin?: () => void
}

const JoinZoomButton: React.FC<PropsWithChildren<JoinZoomButtonProps>> = ({
  type = 'primary',
  zoomLink,
  onJoin,
  className,
  children,
}): React.ReactElement => {
  return (
    <Tooltip
      title={
        zoomLink
          ? 'The meeting is active. Click to join.'
          : 'Sorry, no Zoom link is set for this queue.'
      }
    >
      <Button
        size="large"
        className={cn(
          `text-md mb-0 flex items-center justify-center rounded-md border border-gray-300 font-semibold disabled:opacity-50 md:mb-3 md:w-full`,
          className,
        )}
        onClick={() => {
          if (onJoin) onJoin()
          window.open(zoomLink, '_blank')
        }}
        type={type}
        disabled={!zoomLink}
        icon={<PhoneOutlined aria-hidden="true" />}
      >
        {children}
      </Button>
    </Tooltip>
  )
}

export default JoinZoomButton
