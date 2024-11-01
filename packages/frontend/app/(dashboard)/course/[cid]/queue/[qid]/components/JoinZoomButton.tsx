import { cn } from '@/app/utils/generalUtils'
import { Button, ButtonProps, Tooltip } from 'antd'
import { PhoneOutlined } from '@ant-design/icons'
import { PropsWithChildren } from 'react'

interface JoinZoomButtonProps extends ButtonProps {
  textSize?: 'sm' | 'md' | 'lg'
  zoomLink?: string
  onJoin?: () => void
}

const JoinZoomButton: React.FC<PropsWithChildren<JoinZoomButtonProps>> = ({
  type = 'primary',
  textSize = 'md',
  zoomLink,
  onJoin,
  className,
  children,
}): React.ReactElement => {
  return zoomLink ? (
    <Tooltip title="The meeting is active. Click to join.">
      <Button
        size="large"
        className={cn(
          `text-${textSize} mb-0 flex items-center justify-center rounded-md border border-gray-300 font-semibold disabled:opacity-50 md:mb-3 md:w-full`,
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
  ) : (
    <div className="md: mb-0 flex w-full items-center justify-center rounded-md border border-gray-300 p-2 text-sm font-semibold md:mb-3">
      <p className="text-center">
        {
          "A TA has begun helping you. Be respectful of the TA's time. Be prepared with your question!"
        }
        <br />
        {'Once finished, this popup will automatically close.'}
      </p>
    </div>
  )
}

export default JoinZoomButton
