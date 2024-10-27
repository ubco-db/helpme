import { Button } from 'antd'
import Modal from 'antd/lib/modal/Modal'
import TACheckinButton from '../../../../components/TACheckinButton'
import { ClockCircleOutlined } from '@ant-design/icons'

type EventEndedCheckoutStaffModalProps = {
  courseId: number
  handleClose: () => void
}
const EventEndedCheckoutStaffModal: React.FC<
  EventEndedCheckoutStaffModalProps
> = ({ courseId, handleClose }) => {
  return (
    <Modal
      open={true}
      footer={[
        <Button
          type={'primary'}
          key={'continue'}
          onClick={() => handleClose()}
          icon={<ClockCircleOutlined />}
        >
          I need 10 more minutes
        </Button>,
        <TACheckinButton
          key={'checkOut'}
          state="CheckedIn"
          courseId={courseId}
          onSuccess={handleClose}
          room={'the queue'}
        />,
      ]}
      closable={false}
    >
      <p>The queue session has ended. Would you like to check out?</p>
      <p className="text-gray-500">
        You will be auto-checked out in 10 minutes.
      </p>
    </Modal>
  )
}
export default EventEndedCheckoutStaffModal
