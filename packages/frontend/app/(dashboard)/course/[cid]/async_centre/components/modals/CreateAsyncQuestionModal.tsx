import React, { useState } from 'react'
import { Modal, Input, Form, message } from 'antd'
import { useUserInfo } from '@/app/contexts/userContext'
import { useQuestionTypes } from '@/app/hooks/useQuestionTypes'
import { QuestionTagSelector } from '../../../components/QuestionTagElement'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'

interface FormValues {
  QuestionAbstract: string
  questionText: string
  questionTypesInput: number[]
}

interface CreateAsyncQuestionModalProps {
  courseId: number
  open: boolean
  onCancel: () => void
  onCreateQuestion: () => void
}

const CreateAsyncQuestionModal: React.FC<CreateAsyncQuestionModalProps> = ({
  courseId,
  open,
  onCancel,
  onCreateQuestion,
}) => {
  const { userInfo } = useUserInfo()
  const [questionTypes] = useQuestionTypes(courseId, null)
  const [form] = Form.useForm()
  const [isLoading, setIsLoading] = useState(false)

  const getAiAnswer = async (question: string) => {
    try {
      const data = {
        question: question,
        history: [],
      }
      const response = await fetch(`/chat/${courseId}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          HMS_API_TOKEN: userInfo.chat_token.token,
        },
        body: JSON.stringify(data),
      })
      const json = await response.json()
      return json.answer
    } catch (e) {
      return ''
    }
  }

  const onFinish = async (values: FormValues) => {
    setIsLoading(true)
    const newQuestionTypeInput =
      values.questionTypesInput && questionTypes
        ? questionTypes.filter((questionType) =>
            values.questionTypesInput.includes(questionType.id),
          )
        : []

    // since the ai chatbot may not be running, we don't have a catch statement if it fails and instead we just give it a question text of ''
    await getAiAnswer(
      `
        Question Abstract: ${values.QuestionAbstract}
        Question Text: ${values.questionText}
        Question Types: ${newQuestionTypeInput.map((questionType) => questionType.name).join(', ')}
      `,
    ).then(async (aiAnswer) => {
      await API.asyncQuestions
        .create(
          {
            questionTypes: newQuestionTypeInput,
            questionText: values.questionText,
            aiAnswerText: aiAnswer,
            answerText: aiAnswer,
            questionAbstract: values.QuestionAbstract,
          },
          courseId,
        )
        .then(() => {
          message.success('Question Posted')
          setIsLoading(false)
          onCreateQuestion()
        })
        .catch((e) => {
          const errorMessage = getErrorMessage(e)
          message.error('Error creating question:', errorMessage)
          setIsLoading(false)
        })
    })
  }

  return (
    <Modal
      open={open}
      title="What do you need help with?"
      okText="Finish"
      cancelText="Cancel"
      okButtonProps={{
        autoFocus: true,
        htmlType: 'submit',
        loading: isLoading,
      }}
      cancelButtonProps={{
        danger: true,
      }}
      onCancel={onCancel}
      destroyOnClose
      modalRender={(dom) => (
        <Form
          layout="vertical"
          form={form}
          name="form_in_modal"
          clearOnDestroy
          onFinish={(values) => onFinish(values)}
        >
          {dom}
        </Form>
      )}
    >
      <Form.Item
        name="QuestionAbstract"
        rules={[
          { required: true, message: 'Please input your question abstract' },
          {
            max: 50,
            message: 'Question abstract must be less than 50 characters',
          },
        ]}
      >
        <Input
          placeholder="Question Abstract"
          count={{
            show: true,
            max: 50,
          }}
        />
      </Form.Item>
      <Form.Item name="questionText">
        <Input.TextArea
          placeholder="Question Text"
          autoSize={{ minRows: 3, maxRows: 6 }}
          allowClear
        />
      </Form.Item>
      {questionTypes && questionTypes.length > 0 && (
        <Form.Item
          name="questionTypesInput"
          label="What categories does your question fall under?"
        >
          <QuestionTagSelector questionTags={questionTypes} />
        </Form.Item>
      )}
      <div className="text-gray-700">
        Your question will be anonymous. Other students will not see your name
        or profile image.
      </div>
    </Modal>
  )
}

export default CreateAsyncQuestionModal
