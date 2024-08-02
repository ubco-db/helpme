import { CloseOutlined, FormOutlined } from '@ant-design/icons'
import { AsyncQuestion, asyncQuestionStatus } from '@koh/common'
import { message, Popconfirm, Tooltip } from 'antd'
import { useState } from 'react'
import CircleButton from '../../queue/[qid]/components/CircleButton'
import PostResponseModal from './modals/PostResponseModal'
import { API } from '@/app/api'

type TAAsyncQuestionCardButtonsProps = {
  question: AsyncQuestion
  onAsyncQuestionUpdate: () => void
}

const TAAsyncQuestionCardButtons: React.FC<TAAsyncQuestionCardButtonsProps> = ({
  question,
  onAsyncQuestionUpdate,
}) => {
  const [postResponseModalOpen, setPostResponseModalOpen] = useState(false)

  return (
    <>
      <Popconfirm
        title="Are you sure you want to delete the question?"
        okText="Yes"
        cancelText="No"
        onConfirm={async () => {
          await API.asyncQuestions.update(question.id, {
            status: asyncQuestionStatus.TADeleted,
            visible: false,
          })
          message.success('Removed Question')
          onAsyncQuestionUpdate()
        }}
      >
        <Tooltip title="Delete Question">
          <CircleButton
            variant="red"
            icon={<CloseOutlined />}
            onClick={(event) => {
              setIsExpandedTrue(event)
            }}
          />
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
    </>
  )
}

export default TAAsyncQuestionCardButtons
