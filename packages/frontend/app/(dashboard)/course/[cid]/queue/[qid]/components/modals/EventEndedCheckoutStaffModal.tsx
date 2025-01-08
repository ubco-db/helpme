import { Button } from 'antd'
import Modal from 'antd/lib/modal/Modal'
import TACheckinButton from '../../../../components/TACheckinButton'
import { ClockCircleOutlined } from '@ant-design/icons'
import { useState } from 'react'

type EventEndedCheckoutStaffModalProps = {
  courseId: number
  handleClose: () => Promise<void>
}
const EventEndedCheckoutStaffModal: React.FC<
  EventEndedCheckoutStaffModalProps
> = ({ courseId, handleClose }) => {
  const [isExtraTimeLoading, setIsExtraTimeLoading] = useState(false)

  return (
    <Modal
      open={true}
      footer={[
        <Button
          type={'primary'}
          key={'continue'}
          onClick={async () => {
            setIsExtraTimeLoading(true)
            await handleClose()
            setIsExtraTimeLoading(false)
          }}
          loading={isExtraTimeLoading}
          icon={<ClockCircleOutlined />}
          size="large"
          className="mb-4 ml-auto mr-auto flex"
        >
          I need 10 more minutes
        </Button>,
        <TACheckinButton
          key={'checkOut'}
          state="CheckedIn"
          courseId={courseId}
          onSuccess={handleClose}
          className="ml-auto mr-auto"
        />,
      ]}
      closable={false}
    >
      <div className="flex flex-col items-center">
        <p className="text-lg">
          The queue session has ended. Would you like to check out?
        </p>
        <p className="text-gray-500">
          You will be automatically checked out in 10 minutes.
        </p>
      </div>
    </Modal>
  )
}
export default EventEndedCheckoutStaffModal
