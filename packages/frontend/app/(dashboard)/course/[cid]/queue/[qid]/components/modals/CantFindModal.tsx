import { Button } from 'antd'
import Modal from 'antd/lib/modal/Modal'

type CantFindModalProps = {
  open: boolean
  leaveQueue: () => void
  rejoinQueue: () => void
}

const CantFindModal: React.FC<CantFindModalProps> = ({
  open,
  leaveQueue,
  rejoinQueue,
}) => {
  return (
    <Modal
      centered
      open={open}
      footer={[
        <Button key="leave" danger onClick={leaveQueue}>
          Leave Queue
        </Button>,
        <Button type="primary" key="rejoin" onClick={rejoinQueue}>
          Rejoin Queue
        </Button>,
      ]}
      closable={false}
      title="You couldn't be found!"
    >
      A TA tried to help you, but couldn&apos;t reach you. Are you still in the
      queue? If you are, make sure you are ready, and rejoin the queue.
    </Modal>
  )
}

export default CantFindModal
