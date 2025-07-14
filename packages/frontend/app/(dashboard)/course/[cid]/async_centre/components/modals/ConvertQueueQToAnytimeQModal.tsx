import { useMemo, useState, useEffect } from 'react'
import { Modal, Input, Form, message, Checkbox, Tooltip } from 'antd'
import { useUserInfo } from '@/app/contexts/userContext'
import { useQuestionTypes } from '@/app/hooks/useQuestionTypes'
import { QuestionTagSelector } from '../../../components/QuestionTagElement'
import { API } from '@/app/api'
import { getBrightness, getErrorMessage } from '@/app/utils/generalUtils'
import {
  AlertType,
  ClosedQuestionStatus,
  QuestionType,
  QuestionTypeParams,
  asyncQuestionStatus,
  nameToRGB,
} from '@koh/common'
import { QuestionCircleOutlined } from '@ant-design/icons'
import { useCourseFeatures } from '@/app/hooks/useCourseFeatures'
import tinycolor from 'tinycolor2'

interface FormValues {
  QuestionAbstract: string
  questionText: string
  questionTypesInput: number[]
  refreshAIAnswer: boolean
}

interface ConvertQueueQToAnytimeQModalProps {
  courseId: number
  queueId: number
  open: boolean
  onCancel: () => void
  onCreateOrUpdateQuestion: () => void
}

const ConvertQueueQToAnytimeQModal: React.FC<
  ConvertQueueQToAnytimeQModalProps
> = ({ courseId, queueId, open, onCancel, onCreateOrUpdateQuestion }) => {
  const { userInfo } = useUserInfo()
  const courseFeatures = useCourseFeatures(courseId)
  const [form] = Form.useForm()
  const [isLoading, setIsLoading] = useState(false)
  const [mergedQuestionTypes, setMergedQuestionTypes] = useState<
    QuestionType[]
  >([])
  const [queueQuestionText, setQueueQuestionText] = useState('')
  const [questionAbstract, setQuestionAbstract] = useState('')
  // Get both anytime question tags and queue tags
  const [anytimeQuestionTypes] = useQuestionTypes(courseId, null)
  const [queueQuestionTypes] = useQuestionTypes(courseId, queueId)

  // anytime tags taking priority
  useEffect(() => {
    if (anytimeQuestionTypes && queueQuestionTypes) {
      const merged: QuestionType[] = []
      const tagNames = new Set<string>()

      // anytime question tags (they have priority)
      anytimeQuestionTypes.forEach((tag) => {
        merged.push(tag)
        tagNames.add(tag.name.toLowerCase())
      })

      // queue tags that dont have duplicates (case-insensitive)
      queueQuestionTypes.forEach((tag) => {
        if (!tagNames.has(tag.name.toLowerCase())) {
          merged.push(tag)
          tagNames.add(tag.name.toLowerCase())
        }
      })

      setMergedQuestionTypes(merged)
    } else if (anytimeQuestionTypes) {
      setMergedQuestionTypes(anytimeQuestionTypes)
    } else if (queueQuestionTypes) {
      setMergedQuestionTypes(queueQuestionTypes)
    }
  }, [anytimeQuestionTypes, queueQuestionTypes])

  const RenderQuestionTag = (props: {
    label: React.ReactNode
    value: any
    closable: boolean
    onClose: () => void
  }) => {
    const { label, closable, onClose } = props
    const onPreventMouseDown = (event: React.MouseEvent<HTMLSpanElement>) => {
      event.preventDefault()
      event.stopPropagation()
    }

    const existingTag = mergedQuestionTypes.find((qt) => qt.name === label)
    const tagColor = existingTag
      ? existingTag.color
      : nameToRGB(label as string)
    const textColor = getBrightness(tagColor) < 128 ? 'white' : 'black'

    return (
      <span
        className="ant-tag ant-tag-has-color"
        style={{
          backgroundColor: tagColor,
          color: textColor,
          borderColor: tinycolor(tagColor).darken(10).toString(),
        }}
      >
        {label}
        <span
          className="ant-tag-close-icon"
          onMouseDown={onPreventMouseDown}
          onClick={onClose}
        >
          ×
        </span>
      </span>
    )
  }

  useEffect(() => {
    const fetchQuestion = async () => {
      if (queueId) {
        try {
          const questions = await API.questions.index(queueId)
          const myQuestion = questions.yourQuestions?.[0]
          if (myQuestion?.text) {
            setQueueQuestionText(myQuestion.text)

            // Generating abstract using chatbot
            let generatedAbstract = ''
            try {
              const data = {
                question: `Create a concise title (max 100 chars) for this question. Return ONLY the title, no explanations: ${myQuestion.text}`,
                history: [],
                onlySaveInChatbotDB: true,
              }
              const response = await API.chatbot.studentsOrStaff.askQuestion(
                courseId,
                data,
              )
              generatedAbstract = response.chatbotRepoVersion.answer.trim()

              //  in order to clean up the response - remove quotes, extra text, etc.
              generatedAbstract = generatedAbstract
                .replace(/^["']|["']$/g, '')
                .replace(/^Title:?\s*/i, '')
                .replace(/^Abstract:?\s*/i, '')
                .replace(/^Question:?\s*/i, '')
                .replace(/^Here's?\s*a\s*title:?\s*/i, '')
                .replace(/^The\s*title\s*is:?\s*/i, '')
                .replace(/^I\s*would\s*suggest:?\s*/i, '')
                .replace(/^A\s*concise\s*title\s*would\s*be:?\s*/i, '')
                .replace(/^This\s*question\s*is\s*about:?\s*/i, '')
                .replace(/^Based\s*on\s*the\s*question:?\s*/i, '')
                .replace(/^For\s*this\s*question:?\s*/i, '')
                .trim()

              // If the response is still too long or contains \n, keep the first 8 words
              if (
                generatedAbstract.length > 100 ||
                generatedAbstract.includes('\n')
              ) {
                const words = myQuestion.text.split(' ').slice(0, 8)
                const fallbackTitle = words.join(' ')
                generatedAbstract =
                  fallbackTitle.length > 100
                    ? fallbackTitle.substring(0, 97) + '...'
                    : fallbackTitle
              }
            } catch (chatbotError) {
              console.warn(
                'Chatbot service unavailable, using fallback abstract generation:',
                chatbotError,
              )

              const words = myQuestion.text.split(' ').slice(0, 8)
              const fallbackTitle = words.join(' ')
              generatedAbstract =
                fallbackTitle.length > 100
                  ? fallbackTitle.substring(0, 97) + '...'
                  : fallbackTitle
            }

            setQuestionAbstract(generatedAbstract)

            form.setFieldsValue({
              QuestionAbstract: generatedAbstract,
              questionText: myQuestion.text,
            })
          }
        } catch (e) {
          console.error('Failed to fetch queue question text:', e)
        }
      }
    }
    if (open) {
      fetchQuestion()
    }
  }, [open, queueId, form, courseId, queueId])
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
      console.warn('Chatbot service unavailable for AI answer generation:', e)
      return 'AI service is currently unavailable. Please try again later.'
    }
  }

  const onFinish = async (values: FormValues) => {
    setIsLoading(true)

    // Process question types (same as chatbot version)
    const newQuestionTypeInput =
      values.questionTypesInput && mergedQuestionTypes
        ? mergedQuestionTypes.filter((questionType) =>
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
    }

    try {
      await API.asyncQuestions.create(
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

      const questions = await API.questions.index(queueId)
      const myQuestion = questions.yourQuestions?.[0]
      if (myQuestion) {
        await API.questions.update(myQuestion.id, {
          status: ClosedQuestionStatus.ConfirmedDeleted,
        })
      }

      try {
        const alerts = await API.alerts.get(courseId)
        const queueAlert = alerts.alerts?.find(
          (alert) =>
            alert.alertType === AlertType.PROMPT_STUDENT_TO_LEAVE_QUEUE &&
            (alert.payload as any)?.queueId === queueId,
        )
        if (queueAlert) {
          await API.alerts.close(queueAlert.id)
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
          initialValues={{
            QuestionAbstract: questionAbstract,
            questionText: queueQuestionText,
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
          placeholder="AI will generate a title based on your question"
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
      {mergedQuestionTypes && mergedQuestionTypes.length > 0 && (
        <Form.Item
          name="questionTypesInput"
          label="What categories does your question fall under?"
        >
          <QuestionTagSelector questionTags={mergedQuestionTypes} />
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
      <div className="text-gray-500">
        Only you and faculty will be able to see your question unless a faculty
        member chooses to mark it public, in which case it will appear fully
        anonymous to other students.
      </div>
    </Modal>
  )
}

export default ConvertQueueQToAnytimeQModal
