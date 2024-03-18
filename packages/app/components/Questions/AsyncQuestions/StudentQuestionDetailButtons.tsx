import { CloseOutlined, EditOutlined } from '@ant-design/icons'
import { API } from '@koh/api-client'
import { AsyncQuestion, asyncQuestionStatus } from '@koh/common'
import { message, Popconfirm, Tooltip } from 'antd'
import React, { ReactElement, useState } from 'react'
// import { useTAInQueueInfo } from "../../../hooks/useTAInQueueInfo";
import { CantFindButton, FinishHelpingButton } from '../Queue/Banner'
import { UpdateQuestionForm } from './UpdateAsyncQuestionForm'
import { useAsnycQuestions } from '../../../hooks/useAsyncQuestions'
//import { useTeams } from "../../../hooks/useTeams";

export default function StudentQuestionDetailButtons({
  courseId,
  question,
  setIsExpandedTrue,
  onStatusChange,
}: {
  courseId: number
  question: AsyncQuestion
  setIsExpandedTrue: (event) => void
  onStatusChange: () => void
}): ReactElement {
  const [answerQuestionVisible, setAnswerQuestionVisbile] = useState(false)
  // const handleCancel = () => {
  //   setAnswerQuestionVisbile(false);
  // };
  // const [form] = Form.useForm();
  const { mutateQuestions } = useAsnycQuestions(courseId)

  // if (question.status !== asyncQuestionStatus.Waiting) {
  //   return <></>
  // }
  return (
    <>
      <Popconfirm
        title="Are you sure you want to delete the question?"
        okText="Yes"
        cancelText="No"
        onConfirm={async () => {
          // make sure that deleted questions are not visible
          await API.asyncQuestions.update(question.id, {
            status: asyncQuestionStatus.StudentDeleted,
            visible: false,
          })
          message.success('Removed Question')
          onStatusChange()
        }}
      >
        <Tooltip title="Delete Question">
          <CantFindButton
            shape="circle"
            icon={<CloseOutlined />}
            onClick={(event) => {
              setIsExpandedTrue(event)
            }}
          />
        </Tooltip>
      </Popconfirm>
      <Tooltip title="Edit Your Question">
        <FinishHelpingButton
          icon={<EditOutlined />}
          onClick={(event) => {
            setAnswerQuestionVisbile(true)
            setIsExpandedTrue(event)
          }}
        />
      </Tooltip>
      <UpdateQuestionForm
        question={question}
        visible={answerQuestionVisible}
        onStatusChange={onStatusChange}
        onClose={() => setAnswerQuestionVisbile(false)}
        onQuestionUpdated={mutateQuestions}
      />
    </>
  )
}
