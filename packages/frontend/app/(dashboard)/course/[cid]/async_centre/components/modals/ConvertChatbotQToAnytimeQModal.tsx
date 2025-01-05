import React, { useMemo, useState } from 'react'
import { Modal, Input, Form, message, Checkbox, Tooltip } from 'antd'
import { useUserInfo } from '@/app/contexts/userContext'
import { useQuestionTypes } from '@/app/hooks/useQuestionTypes'
import { QuestionTagSelector } from '../../../components/QuestionTagElement'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { asyncQuestionStatus } from '@koh/common'
import { QuestionCircleOutlined } from '@ant-design/icons'
import { useCourseFeatures } from '@/app/hooks/useCourseFeatures'
import { ChatbotQToConvertToAnytimeQ } from '@/app/typings/chatbot'

interface FormValues {
  QuestionAbstract: string
  questionText: string
  questionTypesInput: number[]
  refreshAIAnswer: boolean
}

interface ConvertChatbotQToAnytimeQModalProps {
  courseId: number
  open: boolean
  onCancel: () => void
  onCreateOrUpdateQuestion: () => void
  chatbotQ: ChatbotQToConvertToAnytimeQ
}

const ConvertChatbotQToAnytimeQModal: React.FC<
  ConvertChatbotQToAnytimeQModalProps
> = ({ courseId, open, onCancel, onCreateOrUpdateQuestion, chatbotQ }) => {
  const { userInfo } = useUserInfo()
  const [questionTypes] = useQuestionTypes(courseId, null)
  const [form] = Form.useForm()
  const [isLoading, setIsLoading] = useState(false)
  const courseFeatures = useCourseFeatures(courseId)

  // the question text is just all of the userMessages concatenated together with a "\n" between them
  const questionText = useMemo(() => {
    return chatbotQ.messages
      .filter((msg) => msg.type === 'userMessage')
      .map((msg) => msg.message)
      .join('\n')
  }, [chatbotQ])

  // the question abstract is just the question text trimmed to 100 characters (and all \n removed)
  const questionAbstract = useMemo(() => {
    return questionText.replace(/\n/g, ' ').slice(0, 100)
  }, [questionText])

  const getAiAnswer = async (question: string) => {
    if (!courseFeatures?.asyncCentreAIAnswers) {
      return ''
    }
    try {
      if (userInfo.chat_token.used < userInfo.chat_token.max_uses) {
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
      } else {
        return 'All AI uses have been used up for today. Please try again tomorrow.'
      }
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

    let aiAnswer = ''
    if (values.refreshAIAnswer) {
      aiAnswer = await getAiAnswer(
        `
            Question Abstract: ${values.QuestionAbstract}
            Question Text: ${values.questionText}
            Question Types: ${newQuestionTypeInput.map((questionType) => questionType.name).join(', ')}
          `,
      )
    } else {
      // if they don't want a new AI answer, leave it as a list of the old answers with "\n" in between them
      // also don't include the first message, since that's the initial "hi how can I help you" message
      aiAnswer = chatbotQ.messages
        .slice(1)
        .filter((msg) => msg.type === 'apiMessage')
        .map((msg) => msg.message)
        .join('\n')
    }
    await API.asyncQuestions
      .create(
        {
          questionTypes: newQuestionTypeInput,
          questionText: values.questionText,
          aiAnswerText: aiAnswer,
          answerText: aiAnswer,
          questionAbstract: values.QuestionAbstract,
          status: asyncQuestionStatus.AIAnsweredNeedsAttention,
        },
        courseId,
      )
      .then(() => {
        message.success('Question Posted')
        setIsLoading(false)
        onCreateOrUpdateQuestion()
      })
      .catch((e) => {
        const errorMessage = getErrorMessage(e)
        message.error('Error creating question:' + errorMessage)
        setIsLoading(false)
      })
  }

  return (
    <Modal
      open={open}
      title={
        <span>
          Convert Chatbot Question
          <Tooltip title="Since you were unsatisfied with your chatbot answer, you can post it here on the anytime question hub, which will allow you to get a human answer from a TA. Feel free to adjust the question text and abstract">
            <span className="ml-2 text-blue-500">
              <QuestionCircleOutlined />
            </span>
          </Tooltip>
        </span>
      }
      okText="Finish"
      cancelText="Cancel"
      okButtonProps={{
        autoFocus: true,
        htmlType: 'submit',
        loading: isLoading,
      }}
      cancelButtonProps={{
        danger: !chatbotQ,
      }}
      onCancel={onCancel}
      footer={(_, { OkBtn, CancelBtn }) => (
        <div className={`flex justify-between md:justify-end`}>
          <div className="ml-1 flex gap-2">
            <CancelBtn />
            <OkBtn />
          </div>
        </div>
      )}
      destroyOnClose
      modalRender={(dom) => (
        <Form
          layout="vertical"
          form={form}
          name="form_in_modal"
          initialValues={{
            QuestionAbstract: questionAbstract,
            questionText: questionText,
          }}
          clearOnDestroy
          onFinish={(values) => onFinish(values)}
        >
          {dom}
        </Form>
      )}
    >
      <Form.Item
        name="QuestionAbstract"
        label="Question Abstract"
        rules={[
          { required: true, message: 'Please input your question abstract' },
          {
            max: 100,
            message: 'Question abstract must be less than 100 characters',
          },
        ]}
      >
        <Input
          count={{
            show: true,
            max: 100,
          }}
        />
      </Form.Item>
      <Form.Item name="questionText" label="Question Text">
        <Input.TextArea autoSize={{ minRows: 3, maxRows: 6 }} allowClear />
      </Form.Item>
      {questionTypes && questionTypes.length > 0 && (
        <Form.Item
          name="questionTypesInput"
          label="What categories does your question fall under?"
        >
          <QuestionTagSelector questionTags={questionTypes} />
        </Form.Item>
      )}
      {courseFeatures?.asyncCentreAIAnswers && (
        <Tooltip
          placement="topLeft"
          title={
            userInfo.chat_token.used >= userInfo.chat_token.max_uses
              ? 'You are out of AI answers for today. Please try again tomorrow.'
              : null
          }
        >
          <Form.Item name="refreshAIAnswer" valuePropName="checked">
            <Checkbox
              disabled={
                userInfo.chat_token.used >= userInfo.chat_token.max_uses
              }
            >
              Get a new AI answer?
            </Checkbox>
          </Form.Item>
        </Tooltip>
      )}
      <div className="text-gray-600">
        Your question will be anonymous. Other students will not see your name
        or profile image.
      </div>
    </Modal>
  )
}

export default ConvertChatbotQToAnytimeQModal
