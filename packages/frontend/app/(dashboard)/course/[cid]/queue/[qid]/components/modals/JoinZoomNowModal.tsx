import Modal from 'antd/lib/modal/Modal'
import { useStudentQuestion } from '@/app/hooks/useStudentQuestion'
import JoinZoomButton from '../JoinZoomButton'
import ReQueuingButton from '../ReQueuingButton'

type JoinZoomNowModalProps = {
  open: boolean
  zoomLink: string
  taName?: string
  setRequeuing: () => void
}

const JoinZoomNowModal: React.FC<JoinZoomNowModalProps> = ({
  open,
  zoomLink,
  taName,
  setRequeuing,
}) => {
  return (
    <Modal
      open={open}
      footer={[]}
      closable={false}
      title={`${taName ?? 'A TA'} is Ready for You Now!`}
    >
      <JoinZoomButton mobileWidth="100%" zoomLink={zoomLink} />
      <ReQueuingButton setRequeuing={setRequeuing} />
    </Modal>
  )
}

export default JoinZoomNowModal
