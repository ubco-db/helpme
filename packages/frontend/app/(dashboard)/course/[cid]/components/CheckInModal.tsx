import { QueuePartial } from '@koh/common'
import { Modal, Select } from 'antd'
import { useState } from 'react'

interface CheckInModalProps {
  visible: boolean
  onSubmit: (queueId: number) => void
  onCancel: () => void
  queues: QueuePartial[]
}

const CheckInModal: React.FC<CheckInModalProps> = ({
  visible,
  onSubmit,
  onCancel,
  queues,
}) => {
  const [queueToCheckInto, setQueueToCheckInto] = useState(-1)
  const onQueueUpdate = (queueIx: number) => {
    setQueueToCheckInto(queueIx)
  }

  return (
    <Modal
      title="Check into a queue"
      open={visible}
      onCancel={() => {
        onCancel()
        setQueueToCheckInto(-1)
      }}
      okText="Check In"
      okButtonProps={{ disabled: queueToCheckInto < 0 }}
      onOk={() => onSubmit(queueToCheckInto)}
    >
      <div className="flex flex-row flex-wrap items-end justify-between">
        <div className="flex flex-grow flex-col justify-start">
          <h3>Select a Queue to check in to</h3>
          <Select
            showSearch
            style={{ width: 300 }}
            placeholder="Select a queue"
            onChange={onQueueUpdate}
            optionFilterProp="label"
            options={queues.map((q, i) => ({ value: i, label: q.room }))}
          />
        </div>
      </div>
    </Modal>
  )
}

export default CheckInModal
