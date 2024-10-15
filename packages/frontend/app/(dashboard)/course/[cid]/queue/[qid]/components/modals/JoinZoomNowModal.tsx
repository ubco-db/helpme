import Modal from 'antd/lib/modal/Modal'
import JoinZoomButton from '../JoinZoomButton'
import ReQueuingButton from '../ReQueuingButton'
import { Popconfirm } from 'antd'
import { InfoCircleFilled } from '@ant-design/icons'
import { useState } from 'react'

type JoinZoomNowModalProps = {
  open: boolean
  zoomLink?: string
  taName?: string
  notes?: string
  onJoin: () => void
  setRequeuing: () => Promise<void>
}

const JoinZoomNowModal: React.FC<JoinZoomNowModalProps> = ({
  open,
  zoomLink,
  taName,
  notes,
  onJoin,
  setRequeuing,
}) => {
  const [isLoadingRequeue, setIsLoadingRequeue] = useState(false)
  return (
    <Modal
      open={open}
      footer={[]}
      style={{ top: '30%' }}
      closable={false}
      title={
        <div className="flex items-center gap-x-2">
          <InfoCircleFilled className="text-2xl text-green-500" />{' '}
          {`${taName ?? 'A TA'} is ready for you now!`}
        </div>
      }
    >
      {notes && notes.length > 0 && (
        <div className="mt-4">
          <p>
            <b>Queue Notes:</b> <i>{notes}</i>
          </p>
        </div>
      )}
      <div className="mt-4 flex h-full w-full flex-col items-center">
        <JoinZoomButton zoomLink={zoomLink} onJoin={onJoin}>
          Join Meeting Now
        </JoinZoomButton>
        <Popconfirm
          title="Are you sure you want to temporarily leave the queue?"
          okButtonProps={{ loading: isLoadingRequeue }}
          onConfirm={() => {
            setIsLoadingRequeue(true)
            setRequeuing().finally(() => setIsLoadingRequeue(false))
          }}
        >
          <ReQueuingButton loading={isLoadingRequeue} />
        </Popconfirm>
      </div>
    </Modal>
  )
}

export default JoinZoomNowModal
