import { DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { AsyncQuestion } from '@koh/common'
import { Popconfirm, Tooltip } from 'antd'
import { useState } from 'react'
import CircleButton from '../../queue/[qid]/components/CircleButton'
import CreateAsyncQuestionModal from './modals/CreateAsyncQuestionModal'
import { useMediaQuery } from '@/app/hooks/useMediaQuery'
import { deleteAsyncQuestion } from '../utils/commonAsyncFunctions'

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
  const isMobile = useMediaQuery('(max-width: 768px)')

  return (
    <>
      {/* Note: Delete button not shown on mobile. Instead, it's in CreateAsyncQuestionModal.tsx*/}
      <Popconfirm
        className="hidden md:flex"
        title="Are you sure you want to delete your question?"
        okText="Yes"
        cancelText="No"
        getPopupContainer={(trigger) => trigger.parentNode as HTMLElement}
        okButtonProps={{ loading: deleteLoading }}
        onConfirm={async () => {
          setDeleteLoading(true)
          await deleteAsyncQuestion(question.id, false, onAsyncQuestionUpdate)
          setDeleteLoading(false)
        }}
      >
        <Tooltip title={isMobile ? '' : 'Delete Question'}>
          <CircleButton customVariant="red" icon={<DeleteOutlined />} />
        </Tooltip>
      </Popconfirm>
      <Tooltip title={isMobile ? '' : 'Edit Your Question'}>
        <CircleButton
          className="mt-0"
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
    </>
  )
}

export default StudentAsyncQuestionCardButtons
