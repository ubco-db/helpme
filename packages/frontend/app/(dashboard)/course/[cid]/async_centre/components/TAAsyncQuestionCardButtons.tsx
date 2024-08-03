import { DeleteOutlined, FormOutlined } from '@ant-design/icons'
import { AsyncQuestion, asyncQuestionStatus } from '@koh/common'
import { message, Popconfirm, Tooltip } from 'antd'
import { useState } from 'react'
import CircleButton from '../../queue/[qid]/components/CircleButton'
import PostResponseModal from './modals/PostResponseModal'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'

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

  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
      }}
    >
      <Popconfirm
        title="Are you sure you want to delete the question?"
        okText="Yes"
        cancelText="No"
        okButtonProps={{ loading: deleteLoading }}
        onConfirm={async () => {
          setDeleteLoading(true)
          await API.asyncQuestions
            .update(question.id, {
              status: asyncQuestionStatus.TADeleted,
              visible: false,
            })
            .then(() => {
              message.success('Removed Question')
              onAsyncQuestionUpdate()
              setDeleteLoading(false)
            })
            .catch((e) => {
              const errorMessage = getErrorMessage(e)
              message.error('Error deleting question:', errorMessage)
              setDeleteLoading(false)
            })
        }}
      >
        <Tooltip title="Delete Question">
          <CircleButton variant="red" icon={<DeleteOutlined />} />
        </Tooltip>
      </Popconfirm>
      <Tooltip title="Post response">
        <CircleButton
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
    </div>
  )
}

export default TAAsyncQuestionCardButtons
