import { CloseOutlined, EditOutlined } from '@ant-design/icons'
import { API } from '@koh/api-client'
import { AsyncQuestion, asyncQuestionStatus } from '@koh/common'
import { message, Popconfirm, Tooltip } from 'antd'
import React, { ReactElement, useState } from 'react'
import { AnswerQuestionModal } from './TAanswerQuestionModal'
import { CantFindButton, FinishHelpingButton } from '../Queue/Banner'

export function TAquestionDetailButtons({
  question,
  setIsExpandedTrue,
  onStatusChange,
}: {
  question: AsyncQuestion
  setIsExpandedTrue: (event) => void
  onStatusChange: () => void
}): ReactElement {
  const [answerQuestionVisible, setAnswerQuestionVisbile] = useState(false)

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
      <Tooltip title="Post response">
        <FinishHelpingButton
          icon={<EditOutlined />}
          onClick={(event) => {
            setAnswerQuestionVisbile(true)
            setIsExpandedTrue(event)
          }}
        />
      </Tooltip>
      <AnswerQuestionModal
        visible={answerQuestionVisible}
        question={question}
        onClose={() => setAnswerQuestionVisbile(false)}
      />
    </>
  )
}
