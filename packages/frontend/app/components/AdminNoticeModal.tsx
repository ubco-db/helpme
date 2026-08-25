import Modal from 'antd/lib/modal/Modal'
import { useState } from 'react'
import { AdminNoticePayload } from '@koh/common'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import MarkdownCustom from './Markdown'
dayjs.extend(relativeTime)

type AdminNoticeModalProps = {
  payload: AdminNoticePayload
  sentAt: Date
  handleClose: () => Promise<void>
}
const AdminNoticeModal: React.FC<AdminNoticeModalProps> = ({
  payload,
  sentAt,
  handleClose,
}) => {
  const [handleCloseLoading, setHandleCloseLoading] = useState(false)

  return (
    <Modal
      open={true}
      confirmLoading={handleCloseLoading}
      cancelButtonProps={{ loading: handleCloseLoading }}
      onCancel={async () => {
        setHandleCloseLoading(true)
        await handleClose()
        setHandleCloseLoading(false)
      }}
      onOk={async () => {
        setHandleCloseLoading(true)
        await handleClose()
        setHandleCloseLoading(false)
      }}
      title={
        <div className="flex flex-col justify-center gap-0">
          <div>{payload.title || 'Admin Notice'}</div>
          <p className="text-sm font-normal text-zinc-500">
            {Math.abs(dayjs().diff(dayjs(sentAt), 'second')) < 30
              ? 'Sent just now'
              : `Sent ${dayjs(sentAt).fromNow()}`}
          </p>
        </div>
      }
    >
      <MarkdownCustom>{payload.message}</MarkdownCustom>
    </Modal>
  )
}
export default AdminNoticeModal
