import React, { useState } from 'react'
import { Modal, Input, Form, message, Select } from 'antd'
import styled from 'styled-components'
import { API } from '@koh/api-client'
import { useRouter } from 'next/router'
import { useProfile } from '../../../hooks/useProfile'
import { useQuestionTypes } from '../../../hooks/useQuestionTypes'
import { QuestionTypeSelector } from '../Shared/QuestionType'

const Container = styled.div`
  max-width: 960px;
`

const QuestionText = styled.div`
  font-weight: normal;
  font-size: 14px;
  line-height: 22px;
  margin-bottom: 4px;
`

interface CreateAsyncQuestionFormProps {
  visible: boolean
  onClose: () => void
  onStatusChange: () => void
}

const CreateAsyncQuestionForm = ({
  visible,
  onClose,
  onStatusChange,
}: CreateAsyncQuestionFormProps) => {
  const router = useRouter()
  const profile = useProfile()
  const courseId = Number(router.query['cid'])
  const [questionTypes] = useQuestionTypes(courseId, null)
  const [form] = Form.useForm()
  const [questionTypeInput, setQuestionTypeInput] = useState([])

  const getAiAnswer = async (questionText: string) => {
    try {
      const data = {
        question: questionText,
        history: [],
      }
      const response = await fetch(`/chat/${courseId}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          HMS_API_TOKEN: profile.chat_token.token,
        },
        body: JSON.stringify(data),
      })
      const json = await response.json()
      return json.answer
    } catch (e) {
      return ''
    }
  }

  const createQuestion = async (value) => {
    const aiAnswer = await getAiAnswer(
      value.QuestionAbstract + ' ' + value.questionText,
    )
    await API.asyncQuestions.create(
      {
        questionTypes: questionTypeInput,
        questionText: value.questionText,
        aiAnswerText: aiAnswer,
        answerText: aiAnswer,
        questionAbstract: value.QuestionAbstract,
      },
      courseId,
    )
    onStatusChange()
    message.success('Question Posted')
  }

  const onFinish = (value) => {
    createQuestion(value)
  }

  const onTypeChange = (selectedIds: number[]) => {
    const newQuestionTypeInput = questionTypes?.filter((questionType) =>
      selectedIds.includes(questionType.id),
    )
    setQuestionTypeInput(newQuestionTypeInput)
  }

  return (
    <Modal
      title="Create New Question"
      open={visible}
      onCancel={onClose}
      onOk={async () => {
        const value = await form.validateFields()
        onFinish(value)
        onClose()
      }}
    >
      <Container>
        <Form form={form}>
          <QuestionText>What do you need help with?</QuestionText>
          <Form.Item name="QuestionAbstract" rules={[{ required: true }]}>
            <Input placeholder="Question abstract" maxLength={50} />
          </Form.Item>
          <Form.Item name="questionText" rules={[{ required: true }]}>
            <Input.TextArea
              allowClear={true}
              placeholder="Question details"
              autoSize={{ minRows: 3, maxRows: 6 }}
            />
          </Form.Item>
          {questionTypes?.length > 0 && (
            <>
              <QuestionText id="question-type-text">
                What category(s) does your question fall under?
              </QuestionText>
              <QuestionTypeSelector
                onChange={onTypeChange}
                value={questionTypeInput.map((type) => type.id)}
                questionTypes={questionTypes}
                className="mb-4"
                ariaLabelledBy="question-type-text"
              />
            </>
          )}
        </Form>
      </Container>
    </Modal>
  )
}

export default CreateAsyncQuestionForm
