import { DeleteOutlined, FormOutlined } from '@ant-design/icons'
import { AsyncQuestion, asyncQuestionStatus } from '@koh/common'
import { message, Popconfirm, Tooltip } from 'antd'
import { useState } from 'react'
import CircleButton from '../../queue/[qid]/components/CircleButton'
import PostResponseModal from './modals/PostResponseModal'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { useMediaQuery } from '@/app/hooks/useMediaQuery'
import { deleteAsyncQuestion } from '../utils/commonAsyncFunctions'

type TAAsyncQuestionCardButtonsProps = {
  question: AsyncQuestion
  onAsyncQuestionUpdate: () => void
}

const TAAsyncQuestionCardButtons: React.FC<TAAsyncQuestionCardButtonsProps> = ({
  question,
  onAsyncQuestionUpdate,
}) => {
  const [postResponseModalOpen, setPostResponseModalOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const isMobile = useMediaQuery('(max-width: 768px)')

  return (
    <>
      {/* Note: Delete button not shown on mobile. Instead, it's in PostResponseModal.tsx*/}
      <Popconfirm
        className="hidden md:flex"
        title="Are you sure you want to delete the question?"
        okText="Yes"
        cancelText="No"
        okButtonProps={{ loading: deleteLoading }}
        onConfirm={async () => {
          setDeleteLoading(true)
          await deleteAsyncQuestion(question.id, true, onAsyncQuestionUpdate)
          setDeleteLoading(false)
        }}
      >
        <Tooltip title={isMobile ? '' : 'Delete Question'}>
          <CircleButton variant="red" icon={<DeleteOutlined />} />
        </Tooltip>
      </Popconfirm>
      <Tooltip title={isMobile ? '' : 'Post response'}>
        <CircleButton
          className="mt-0"
          variant="primary"
          icon={<FormOutlined />}
          onClick={() => {
            setPostResponseModalOpen(true)
          }}
        />
      </Tooltip>
      <PostResponseModal
        open={postResponseModalOpen}
        question={question}
        onCancel={() => setPostResponseModalOpen(false)}
        onPostResponse={() => {
          onAsyncQuestionUpdate()
          setPostResponseModalOpen(false)
        }}
      />
    </>
  )
}

export default TAAsyncQuestionCardButtons
