import Modal from 'antd/lib/modal/Modal'
import { useStudentQuestion } from '@/app/hooks/useStudentQuestion'
import JoinZoomButton from '../JoinZoomButton'
import ReQueuingButton from '../ReQueuingButton'

type JoinZoomNowModalProps = {
  open: boolean
  zoomLink?: string
  taName?: string
  onJoin: () => void
  setRequeuing: () => void
}

const JoinZoomNowModal: React.FC<JoinZoomNowModalProps> = ({
  open,
  zoomLink,
  taName,
  onJoin,
  setRequeuing,
}) => {
  return (
    <Modal
      open={open}
      footer={[]}
      style={{ top: '30%' }}
      closable={false}
      title={`${taName ?? 'A TA'} is Ready for You Now!`}
    >
      <div className="mt-8 flex h-full w-full flex-col items-center">
        <JoinZoomButton zoomLink={zoomLink} onJoin={onJoin}>
          Join Meeting Now
        </JoinZoomButton>
        <ReQueuingButton setRequeuing={setRequeuing} />
      </div>
    </Modal>
  )
}

export default JoinZoomNowModal
