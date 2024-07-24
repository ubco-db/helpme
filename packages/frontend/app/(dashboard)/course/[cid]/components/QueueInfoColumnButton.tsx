import { Button, ButtonProps } from 'antd'
import { PropsWithChildren } from 'react'

const JoinQueueButton: React.FC<
  PropsWithChildren<QueueInfoColumnButtonProps>
> = (props) => (
  <QueueInfoColumnButton
    {...props}
    className={`bg-[#3684c6] text-white ${props.className}`}
  />
)

const EditQueueButton: React.FC<
  PropsWithChildren<QueueInfoColumnButtonProps>
> = (props) => (
  <QueueInfoColumnButton
    {...props}
    className={`text-gray-900 ${props.className}`}
  />
)

const DisableQueueButton: React.FC<
  PropsWithChildren<QueueInfoColumnButtonProps>
> = (props) => (
  <QueueInfoColumnButton
    {...props}
    className={`bg-red-600 text-white hover:focus:bg-red-500 ${props.className}`}
  />
)

const ClearQueueButton: React.FC<
  PropsWithChildren<QueueInfoColumnButtonProps>
> = (props) => (
  <QueueInfoColumnButton
    {...props}
    className={`border border-red-600 bg-white text-red-600 hover:focus:bg-gray-300 ${props.className}`}
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
      className={`mb-0 flex items-center justify-center rounded-md border border-gray-300 text-sm font-semibold md:mb-3 md:w-full w-[${mobileWidth}] ${className}`}
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
