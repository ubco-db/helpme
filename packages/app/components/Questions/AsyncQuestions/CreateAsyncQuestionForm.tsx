import React, { useState, useEffect } from 'react'
import { Modal, Input, Form, message, Select } from 'antd'
import styled from 'styled-components'
import { API } from '@koh/api-client'
import { useRouter } from 'next/router'
import { QuestionTypeParams } from '@koh/common'
import { useProfile } from '../../../hooks/useProfile'

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
  const [form] = Form.useForm()
  const [questionsTypeState, setQuestionsTypeState] = useState<
    QuestionTypeParams[]
  >([])
  const [questionTypeInput, setQuestionTypeInput] = useState([])

  useEffect(() => {
    const populateQuestionTypes = async () => {
      const questions = await API.questionType.getQuestionTypes(courseId, null)
      setQuestionsTypeState(questions)
    }
    populateQuestionTypes()
  }, [courseId])

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
    const newQuestionTypeInput = questionsTypeState.filter((questionType) =>
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
          {questionsTypeState.length > 0 && (
            <>
              <QuestionText>
                What category(s) does your question fall under?
              </QuestionText>
              <Select
                mode="multiple"
                placeholder="Select question tags"
                onChange={onTypeChange}
                style={{ width: '100%' }}
                value={questionTypeInput.map((type) => type.id)}
              >
                {questionsTypeState.map((type) => (
                  <Select.Option value={type.id} key={type.id}>
                    {type.name}
                  </Select.Option>
                ))}
              </Select>
            </>
          )}
        </Form>
      </Container>
    </Modal>
  )
}

export default CreateAsyncQuestionForm
