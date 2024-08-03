import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { AsyncQuestion, asyncQuestionStatus } from '@koh/common'
import { message, Popconfirm, Tooltip } from 'antd'
import { useState } from 'react'
import CircleButton from '../../queue/[qid]/components/CircleButton'
import CreateAsyncQuestionModal from './modals/CreateAsyncQuestionModal'

type StudentAsyncQuestionCardButtonsProps = {
  question: AsyncQuestion
  onAsyncQuestionUpdate: () => void
  courseId: number
}

const StudentAsyncQuestionCardButtons: React.FC<
  StudentAsyncQuestionCardButtonsProps
> = ({ question, onAsyncQuestionUpdate, courseId }) => {
  const [createAsyncQuestionModalOpen, setCreateAsyncQuestionModalOpen] =
    useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
      }}
    >
      <Popconfirm
        title="Are you sure you want to delete your question?"
        okText="Yes"
        cancelText="No"
        okButtonProps={{ loading: deleteLoading }}
        onConfirm={async () => {
          setDeleteLoading(true)
          await API.asyncQuestions
            .update(question.id, {
              status: asyncQuestionStatus.StudentDeleted,
              visible: false,
            })
            .then(() => {
              message.success('Question Successfully Deleted')
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
      <Tooltip title="Edit Your Question">
        <CircleButton
          icon={<EditOutlined />}
          onClick={() => {
            setCreateAsyncQuestionModalOpen(true)
          }}
        />
      </Tooltip>
      <CreateAsyncQuestionModal
        courseId={courseId}
        question={question}
        open={createAsyncQuestionModalOpen}
        onCancel={() => setCreateAsyncQuestionModalOpen(false)}
        onCreateOrUpdateQuestion={() => {
          setCreateAsyncQuestionModalOpen(false)
          onAsyncQuestionUpdate()
        }}
      />
    </div>
  )
}

export default StudentAsyncQuestionCardButtons
