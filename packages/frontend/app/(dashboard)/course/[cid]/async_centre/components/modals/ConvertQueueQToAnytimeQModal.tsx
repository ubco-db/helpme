import { useEffect, useState } from 'react'
import { Form, Input, message, Modal, Spin, Tooltip } from 'antd'
import { useUserInfo } from '@/app/contexts/userContext'
import { useQuestionTypes } from '@/app/hooks/useQuestionTypes'
import { QuestionTagSelector } from '../../../components/QuestionTagElement'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import {
  AlertType,
  asyncQuestionStatus,
  ClosedQuestionStatus,
} from '@koh/common'
import { QuestionCircleOutlined } from '@ant-design/icons'
import { useCourseFeatures } from '@/app/hooks/useCourseFeatures'

interface FormValues {
  QuestionAbstract: string
  questionText: string
  questionTypesInput: number[]
  refreshAIAnswer: boolean
}

interface ConvertQueueQToAnytimeQModalProps {
  courseId: number
  queueId: number
  queueQuestionId: number
  open: boolean
  onCancel: () => void
  onCreateOrUpdateQuestion: () => void
}

const ConvertQueueQToAnytimeQModal: React.FC<
  ConvertQueueQToAnytimeQModalProps
> = ({
  courseId,
  queueId,
  queueQuestionId,
  open,
  onCancel,
  onCreateOrUpdateQuestion,
}) => {
  const { userInfo } = useUserInfo()
  const courseFeatures = useCourseFeatures(courseId)
  const [form] = Form.useForm()
  const [isLoading, setIsLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(false)
  const [isGeneratingAbstract, setIsGeneratingAbstract] = useState(false)
  // Get both anytime question tags and queue tags.
  const [anytimeQuestionTypes] = useQuestionTypes(courseId, null)

  const fallbackGenerateAbstract = (question: string) => {
    const words = question.split(' ').slice(0, 8)
    const fallbackTitle = words.join(' ')
    return fallbackTitle.length > 100
      ? fallbackTitle.substring(0, 97) + '...'
      : fallbackTitle
  }

  useEffect(() => {
    if (open && queueQuestionId) {
      const fetchQuestion = async () => {
        setInitialLoading(true)
        try {
          const myQuestion = await API.questions.update(queueQuestionId, {})
          if (!myQuestion?.text) {
            message.error('Failed to load question data.')
            setInitialLoading(false)
            return
          }

          const queueTags = new Set(
            myQuestion.questionTypes?.map((qt) =>
              qt.name.toLowerCase().trim(),
            ) || [],
          )

          const anytimeTags = anytimeQuestionTypes
            ?.filter((globalTag) =>
              queueTags.has(globalTag.name.toLowerCase().trim()),
            )
            .map((tag) => tag.id)

          form.resetFields(['questionTypesInput']) // required to preselect the matching tags selected on the queue question creation modal.
          form.setFieldsValue({
            questionText: myQuestion.text,
            questionTypesInput: anytimeTags,
          })

          setInitialLoading(false)

          setIsGeneratingAbstract(true)
          let generatedAbstract = ''
          try {
            const response = await API.chatbot.studentsOrStaff.queryChatbot(
              courseId,
              {
                query: myQuestion.text,
                type: 'abstract',
              },
            )

            const idx = response.indexOf(':')
            generatedAbstract = response.substring(idx + 1)
            generatedAbstract = response.replace(/^["']|["']$/g, '')
            generatedAbstract = generatedAbstract.trim()

            if (
              generatedAbstract.length > 100 ||
              generatedAbstract.includes('\n')
            ) {
              generatedAbstract = fallbackGenerateAbstract(generatedAbstract)
            }

            form.setFieldsValue({ QuestionAbstract: generatedAbstract })
          } catch (chatbotError) {
            console.warn('Chatbot failed, using fallback', chatbotError)
            const fallbackAbstract = fallbackGenerateAbstract(myQuestion.text)
            form.setFieldsValue({ QuestionAbstract: fallbackAbstract })
          } finally {
            setIsGeneratingAbstract(false)
          }
        } catch (e) {
          console.error('Failed to fetch queue question text:', e)
          message.error('Failed to load question data.')
          setInitialLoading(false)
        }
      }
      fetchQuestion().then()
    }
  }, [open, queueQuestionId, courseId, form, anytimeQuestionTypes])

  const onFinish = async (values: FormValues) => {
    setIsLoading(true)

    // Process question types (same as chatbot version)
    const newQuestionTypeInput =
      values.questionTypesInput && anytimeQuestionTypes
        ? anytimeQuestionTypes.filter((questionType) =>
            values.questionTypesInput.includes(questionType.id),
          )
        : []

    try {
      await API.asyncQuestions.create(
        {
          questionTypes: newQuestionTypeInput,
          questionText: values.questionText,
          questionAbstract: values.QuestionAbstract,
          status: asyncQuestionStatus.AIAnsweredNeedsAttention,
        },
        courseId,
      )

      if (queueQuestionId) {
        await API.questions.update(queueQuestionId, {
          status: ClosedQuestionStatus.ConfirmedDeleted,
        })
      }

      try {
        if (queueId) {
          const alerts = await API.alerts.get(courseId)
          const queueAlert = alerts.alerts?.find(
            (alert) =>
              alert.alertType === AlertType.PROMPT_STUDENT_TO_LEAVE_QUEUE &&
              (alert.payload as any)?.queueId === queueId,
          )
          if (queueAlert) {
            await API.alerts.close(queueAlert.id)
          }
        }
      } catch (alertError) {
        console.warn('Failed to close alert:', alertError)
      }
      message.success('Question Posted')
      setIsLoading(false)
      onCreateOrUpdateQuestion()
    } catch (e) {
      const errorMessage = getErrorMessage(e)
      message.error('Error creating question:' + errorMessage)
      setIsLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      title={
        <span>
          Convert Queue Question to Anytime Question
          <Tooltip title="This will convert your queue question into an anytime question, allowing you to get a more detailed, asynchronous answer from course staff.">
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
        disabled: initialLoading,
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
      destroyOnHidden
      modalRender={(dom) => (
        <Form
          layout="vertical"
          form={form}
          name="form_in_modal"
          clearOnDestroy
          onFinish={(values) => onFinish(values)}
        >
          <Spin spinning={initialLoading} tip="Loading question details...">
            {dom}
          </Spin>
        </Form>
      )}
    >
      <Form.Item
        name="QuestionAbstract"
        label="Question Abstract (AI-Generated)"
        tooltip="An AI-generated short summary of your question. You can edit this if needed."
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
          placeholder={
            isGeneratingAbstract
              ? 'Generating abstract...'
              : 'AI will generate a title based on your question'
          }
          disabled={isGeneratingAbstract}
          count={{
            show: true,
            max: 100,
          }}
        />
      </Form.Item>
      <Form.Item
        name="questionText"
        label="Question Text"
        tooltip="Full question text from the queue."
        required={true}
        rules={[{ required: true, message: 'Question text is required!' }]}
      >
        <Input.TextArea
          placeholder="Your question text will appear here"
          autoSize={{ minRows: 3, maxRows: 6 }}
          allowClear
        />
      </Form.Item>
      {anytimeQuestionTypes && anytimeQuestionTypes.length > 0 && (
        <Form.Item
          name="questionTypesInput"
          label="What categories does your question fall under?"
        >
          <QuestionTagSelector questionTags={anytimeQuestionTypes} />
        </Form.Item>
      )}
      <div className="text-gray-500">
        Only you and faculty will be able to see your question unless a faculty
        member chooses to mark it public, in which case it will appear fully
        anonymous to other students.
      </div>
    </Modal>
  )
}

export default ConvertQueueQToAnytimeQModal
