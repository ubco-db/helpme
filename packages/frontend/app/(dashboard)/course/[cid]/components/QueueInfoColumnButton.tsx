import { cn } from '@/app/utils/generalUtils'
import { Button, ButtonProps } from 'antd'
import { PropsWithChildren } from 'react'

const JoinQueueButton: React.FC<
  PropsWithChildren<QueueInfoColumnButtonProps>
> = (props) => (
  <QueueInfoColumnButton
    {...props}
    className={`bg-[#3684c6] text-white enabled:hover:bg-blue-400 enabled:focus:bg-blue-400 ${props.className}`}
  />
)

const EditQueueButton: React.FC<
  PropsWithChildren<QueueInfoColumnButtonProps>
> = (props) => (
  <QueueInfoColumnButton
    {...props}
    className={`text-gray-900 enabled:hover:bg-gray-100 enabled:focus:bg-gray-100 ${props.className}`}
  />
)

const DisableQueueButton: React.FC<
  PropsWithChildren<QueueInfoColumnButtonProps>
> = (props) => (
  <QueueInfoColumnButton
    {...props}
    className={`bg-red-600 text-white hover:bg-red-500 focus:bg-red-500 ${props.className}`}
  />
)

const ClearQueueButton: React.FC<
  PropsWithChildren<QueueInfoColumnButtonProps>
> = (props) => (
  <QueueInfoColumnButton
    {...props}
    className={`border border-red-600 bg-white text-red-600 hover:bg-gray-100 focus:bg-gray-100 ${props.className}`}
  />
)

interface QueueInfoColumnButtonProps extends ButtonProps {
  mobileWidth?: string
}
/**
 * These buttons are used in the QueueInfoColumn component (i.e. the column on the left side of the Queue Page).
 * @param mobileWidth - The width of the button on mobile (e.g. `45%`)
 */
const QueueInfoColumnButton: React.FC<
  PropsWithChildren<QueueInfoColumnButtonProps>
> = ({
  mobileWidth = '100%',
  children,
  className,
  ...props
}): React.ReactElement => {
  return (
    <Button
      size="large"
      className={cn(
        `mb-0 flex items-center justify-center rounded-md border border-gray-300 text-sm font-semibold md:mb-3 md:w-full w-[${mobileWidth}] disabled:opacity-50`,
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  )
}

export {
  QueueInfoColumnButton,
  EditQueueButton,
  JoinQueueButton,
  DisableQueueButton,
  ClearQueueButton,
}
