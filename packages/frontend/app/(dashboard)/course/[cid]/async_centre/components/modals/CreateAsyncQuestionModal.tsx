import React, { useState } from 'react'
import {
  Modal,
  Input,
  Form,
  message,
  Checkbox,
  Tooltip,
  Button,
  Popconfirm,
  Spin,
} from 'antd'
import { useUserInfo } from '@/app/contexts/userContext'
import { useQuestionTypes } from '@/app/hooks/useQuestionTypes'
import { QuestionTagSelector } from '../../../components/QuestionTagElement'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { AsyncQuestion, asyncQuestionStatus } from '@koh/common'
import { DeleteOutlined } from '@ant-design/icons'
import { deleteAsyncQuestion } from '../../utils/commonAsyncFunctions'
import { useCourseFeatures } from '@/app/hooks/useCourseFeatures'
import { Wand2 } from 'lucide-react'

interface FormValues {
  QuestionAbstract: string
  questionText: string
  questionTypesInput: number[]
  refreshAIAnswer: boolean
}

interface CreateAsyncQuestionModalProps {
  courseId: number
  open: boolean
  onCancel: () => void
  onCreateOrUpdateQuestion: () => void
  question?: AsyncQuestion // if it's defined, then it's an edit modal
}

const CreateAsyncQuestionModal: React.FC<CreateAsyncQuestionModalProps> = ({
  courseId,
  open,
  onCancel,
  onCreateOrUpdateQuestion,
  question,
}) => {
  const { userInfo } = useUserInfo()
  const [questionTypes] = useQuestionTypes(courseId, null)
  const [form] = Form.useForm()
  const [isLoading, setIsLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [isGeneratingAbstract, setIsGeneratingAbstract] = useState(false)
  const courseFeatures = useCourseFeatures(courseId)

  const fallbackGenerateAbstract = (question: string) => {
    const words = question.split(' ').slice(0, 8)
    const fallbackTitle = words.join(' ')
    return fallbackTitle.length > 100
      ? fallbackTitle.substring(0, 97) + '...'
      : fallbackTitle
  }

  const onGenerateAbstract = async () => {
    const questionText = form.getFieldValue('questionText')
    if (!questionText) {
      message.error(
        'Please enter your question text before generating an abstract.',
      )
      return
    }

    setIsGeneratingAbstract(true)
    try {
      const response = await API.chatbot.studentsOrStaff.queryChatbot(
        courseId,
        {
          query: questionText,
          type: 'abstract',
        },
      )

      const idx = response.indexOf(':')
      let generatedAbstract = response.substring(idx + 1)
      generatedAbstract = generatedAbstract.replace(/^["']|["']$/g, '').trim()

      if (generatedAbstract.length > 100 || generatedAbstract.includes('\n')) {
        generatedAbstract = fallbackGenerateAbstract(generatedAbstract)
      }

      form.setFieldsValue({ QuestionAbstract: generatedAbstract })
    } catch (chatbotError) {
      console.warn('Chatbot failed, using fallback', chatbotError)
      const fallbackAbstract = fallbackGenerateAbstract(questionText)
      form.setFieldsValue({ QuestionAbstract: fallbackAbstract })
    } finally {
      setIsGeneratingAbstract(false)
    }
  }

  const getAiAnswer = async (question: string) => {
    if (!courseFeatures?.asyncCentreAIAnswers) {
      return ''
    }
    try {
      if (userInfo.chat_token.used < userInfo.chat_token.max_uses) {
        const data = {
          question: question,
          history: [],
          onlySaveInChatbotDB: true,
        }
        const response = await API.chatbot.studentsOrStaff.askQuestion(
          courseId,
          data,
        )
        return response.chatbotRepoVersion.answer
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

    // If editing a question, update the question. Else create a new one
    if (question) {
      if (values.refreshAIAnswer) {
        await getAiAnswer(
          `
            Question Abstract: ${values.QuestionAbstract}
            Question Text: ${values.questionText}
            Question Types: ${newQuestionTypeInput.map((questionType) => questionType.name).join(', ')}
          `,
        ).then(async (aiAnswer) => {
          await API.asyncQuestions
            .studentUpdate(question.id, {
              questionTypes: newQuestionTypeInput,
              questionText: values.questionText,
              questionAbstract: values.QuestionAbstract,
              aiAnswerText: aiAnswer,
              answerText: aiAnswer,
            })
            .then(() => {
              message.success('Question Updated')
              setIsLoading(false)
              onCreateOrUpdateQuestion()
            })
            .catch((e) => {
              const errorMessage = getErrorMessage(e)
              message.error('Error updating question:' + errorMessage)
              setIsLoading(false)
            })
        })
      } else {
        await API.asyncQuestions
          .studentUpdate(question.id, {
            questionTypes: newQuestionTypeInput,
            questionText: values.questionText,
            questionAbstract: values.QuestionAbstract,
          })
          .then(() => {
            message.success('Question Updated')
            onCreateOrUpdateQuestion()
          })
          .catch((e) => {
            const errorMessage = getErrorMessage(e)
            message.error('Error updating question:' + errorMessage)
          })
          .finally(() => {
            setIsLoading(false)
          })
      }
    } else {
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
              status: courseFeatures?.asyncCentreAIAnswers
                ? asyncQuestionStatus.AIAnswered
                : asyncQuestionStatus.AIAnsweredNeedsAttention,
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
      })
    }
  }

  return (
    <Modal
      open={open}
      title={question ? 'Edit Question' : 'What do you need help with?'}
      okText="Finish"
      cancelText="Cancel"
      okButtonProps={{
        autoFocus: true,
        htmlType: 'submit',
        loading: isLoading,
      }}
      cancelButtonProps={{
        danger: !question,
      }}
      onCancel={onCancel}
      // display delete button for mobile in footer
      footer={(_, { OkBtn, CancelBtn }) => (
        <div
          className={`flex md:justify-end ${question ? 'justify-between' : 'justify-end'}`}
        >
          {question && (
            <Popconfirm
              className="flex md:hidden"
              title="Are you sure you want to delete your question?"
              okText="Yes"
              cancelText="No"
              getPopupContainer={(trigger) => trigger.parentNode as HTMLElement}
              okButtonProps={{ loading: deleteLoading }}
              onConfirm={async () => {
                setDeleteLoading(true)
                await deleteAsyncQuestion(
                  question.id,
                  false,
                  onCreateOrUpdateQuestion,
                )
                setDeleteLoading(false)
              }}
            >
              <Button danger type="primary" icon={<DeleteOutlined />}>
                {' '}
                Delete Question{' '}
              </Button>
            </Popconfirm>
          )}
          <div className="ml-1 flex gap-2">
            <CancelBtn />
            <OkBtn />
          </div>
        </div>
      )}
      destroyOnHidden
      modalRender={(dom) => (
        <Form
          layout="vertical"
          form={form}
          name="form_in_modal"
          initialValues={{
            QuestionAbstract: question?.questionAbstract,
            questionText: question?.questionText,
            questionTypesInput:
              questionTypes && questionTypes.length > 0
                ? question?.questionTypes?.map(
                    (questionType) => questionType.id,
                  )
                : [],
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
        tooltip="A short summary/description of the question (or the question itself)"
        required={true}
        rules={[
          { required: true, message: 'Please input your question abstract' },
          {
            max: 100,
            message: 'Question abstract must be less than 100 characters',
          },
        ]}
      >
        <Input
          placeholder="Stuck on Lab 3 part C"
          disabled={isGeneratingAbstract}
          count={{
            show: true,
            max: 100,
          }}
          suffix={
            <Tooltip title="Generate Abstract based on Question Text">
              <Button
                type="text"
                icon={isGeneratingAbstract ? <Spin /> : <Wand2 size={16} />}
                onClick={onGenerateAbstract}
                disabled={isGeneratingAbstract}
              />
            </Tooltip>
          }
        />
      </Form.Item>
      <Form.Item
        name="questionText"
        label="Question Text"
        tooltip="Your full question text. The placeholder text is just an example"
      >
        <Input.TextArea
          placeholder="It's asking me to... but I got an incorrect answer. Here is my work:..."
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
      {question && courseFeatures?.asyncCentreAIAnswers && (
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
      <div className="text-gray-500">
        Only you and faculty will be able to see your question unless a faculty
        member chooses to mark it public, in which case it will appear fully
        anonymous to other students.
      </div>
    </Modal>
  )
}

export default CreateAsyncQuestionModal
