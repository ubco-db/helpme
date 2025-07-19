import { DeleteOutlined, EditOutlined, FormOutlined } from '@ant-design/icons'
import { AsyncQuestion } from '@koh/common'
import { Popconfirm, Tooltip } from 'antd'
import { useState } from 'react'
import CircleButton from '../../queue/[qid]/components/CircleButton'
import PostResponseModal from './modals/PostResponseModal'
import { useMediaQuery } from '@/app/hooks/useMediaQuery'
import { deleteAsyncQuestion } from '../utils/commonAsyncFunctions'
import { useUserInfo } from '@/app/contexts/userContext'
import CreateAsyncQuestionModal from '@/app/(dashboard)/course/[cid]/async_centre/components/modals/CreateAsyncQuestionModal'

type TAAsyncQuestionCardButtonsProps = {
  question: AsyncQuestion
  onAsyncQuestionUpdate: () => void
  courseId: number
}

const TAAsyncQuestionCardButtons: React.FC<TAAsyncQuestionCardButtonsProps> = ({
  question,
  onAsyncQuestionUpdate,
  courseId,
}) => {
  const { userInfo } = useUserInfo()
  const [postResponseModalOpen, setPostResponseModalOpen] = useState(false)
  const [createAsyncQuestionModalOpen, setCreateAsyncQuestionModalOpen] =
    useState(false)
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
          <CircleButton customVariant="red" icon={<DeleteOutlined />} />
        </Tooltip>
      </Popconfirm>
      {question.creator.id == userInfo.id && (
        <Tooltip title={isMobile ? '' : 'Edit Question'}>
          <CircleButton
            className="mt-0 hidden md:flex"
            customVariant="primary"
            icon={<EditOutlined />}
            onClick={() => {
              setCreateAsyncQuestionModalOpen(true)
            }}
          />
        </Tooltip>
      )}
      <Tooltip title={isMobile ? '' : 'Post response'}>
        <CircleButton
          className="mt-0"
          customVariant="green"
          icon={<FormOutlined />}
          onClick={() => {
            setPostResponseModalOpen(true)
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
      <PostResponseModal
        open={postResponseModalOpen}
        question={question}
        onCancel={() => setPostResponseModalOpen(false)}
        onPostResponse={() => {
          onAsyncQuestionUpdate()
          setPostResponseModalOpen(false)
        }}
        courseId={courseId}
        setCreateAsyncQuestionModalOpen={setCreateAsyncQuestionModalOpen}
      />
    </>
  )
}

export default TAAsyncQuestionCardButtons
