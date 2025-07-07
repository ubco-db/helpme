import { Button, Checkbox, Form, Input, Modal, message, Tooltip } from 'antd'
import { useEffect, useState } from 'react'
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
import { useQuestionTypes } from '@/app/hooks/useQuestionTypes'
import { QuestionTagSelector } from '../../../components/QuestionTagElement'
import tinycolor from 'tinycolor2'
import { QuestionCircleOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'

type ConvertQueueQToAnytimeQModalProps = {
  isOpen: boolean
  handleClose: () => void
  cid: number
  qid: number
  onCancel?: () => void
}

const ConvertQueueQToAnytimeQModal: React.FC<
  ConvertQueueQToAnytimeQModalProps
> = ({ isOpen, handleClose, cid, qid, onCancel }) => {
  const [form] = Form.useForm()
  const [isLoading, setIsLoading] = useState(false)
  const [mergedQuestionTypes, setMergedQuestionTypes] = useState<
    QuestionType[]
  >([])
  const router = useRouter()

  // Fetch both anytime question tags and queue tags
  const [anytimeQuestionTypes] = useQuestionTypes(cid, null)
  const [queueQuestionTypes] = useQuestionTypes(cid, qid)

  // anytime tags taking priority
  useEffect(() => {
    if (anytimeQuestionTypes && queueQuestionTypes) {
      const merged: QuestionType[] = []
      const seenNames = new Set<string>()

      // anytime question tags (they have priority)
      anytimeQuestionTypes.forEach((tag) => {
        merged.push(tag)
        seenNames.add(tag.name.toLowerCase())
      })

      // queue tags that dont have duplicates (case-insensitive)
      queueQuestionTypes.forEach((tag) => {
        if (!seenNames.has(tag.name.toLowerCase())) {
          merged.push(tag)
          seenNames.add(tag.name.toLowerCase())
        }
      })

      setMergedQuestionTypes(merged)
    } else if (anytimeQuestionTypes) {
      setMergedQuestionTypes(anytimeQuestionTypes)
    } else if (queueQuestionTypes) {
      setMergedQuestionTypes(queueQuestionTypes)
    }
  }, [anytimeQuestionTypes, queueQuestionTypes])

  const tagRender = (props: {
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
      if (qid) {
        try {
          const questions = await API.questions.index(qid)
          const myQuestion = questions.yourQuestions?.[0]
          if (myQuestion?.text) {
            // Put the entire question text in the body
            form.setFieldsValue({
              body: myQuestion.text,
            })

            // Generate abstract using chatbot service
            try {
              const data = {
                question: `Create a concise title (max 100 chars) for this question. Return ONLY the title, no explanations: ${myQuestion.text}`,
                history: [],
                onlySaveInChatbotDB: true,
              }
              const response = await API.chatbot.studentsOrStaff.askQuestion(
                cid,
                data,
              )
              let generatedAbstract = response.chatbotRepoVersion.answer.trim()

              // Clean up the response - remove quotes, extra text, etc.
              generatedAbstract = generatedAbstract
                .replace(/^["']|["']$/g, '') // Remove surrounding quotes
                .replace(/^Title:?\s*/i, '') // Remove "Title:" prefix
                .replace(/^Abstract:?\s*/i, '') // Remove "Abstract:" prefix
                .replace(/^Question:?\s*/i, '') // Remove "Question:" prefix
                .replace(/^Here's?\s*a\s*title:?\s*/i, '') // Remove "Here's a title:" prefix
                .replace(/^The\s*title\s*is:?\s*/i, '') // Remove "The title is:" prefix
                .replace(/^I\s*would\s*suggest:?\s*/i, '') // Remove "I would suggest:" prefix
                .replace(/^A\s*concise\s*title\s*would\s*be:?\s*/i, '') // Remove explanatory text
                .replace(/^This\s*question\s*is\s*about:?\s*/i, '') // Remove "This question is about:" prefix
                .replace(/^Based\s*on\s*the\s*question:?\s*/i, '') // Remove "Based on the question:" prefix
                .replace(/^For\s*this\s*question:?\s*/i, '') // Remove "For this question:" prefix
                .trim()

              // If the response is still too long or contains newlines, fallback
              if (
                generatedAbstract.length > 100 ||
                generatedAbstract.includes('\n')
              ) {
                // Create a simple fallback title
                const words = myQuestion.text.split(' ').slice(0, 8) // Take first 8 words
                const fallbackTitle = words.join(' ')
                generatedAbstract =
                  fallbackTitle.length > 100
                    ? fallbackTitle.substring(0, 97) + '...'
                    : fallbackTitle
              }

              form.setFieldsValue({
                abstract: generatedAbstract,
              })
            } catch (chatbotError) {
              // Fallback to first 100 characters if chatbot fails
              form.setFieldsValue({
                abstract: myQuestion.text.substring(0, 100),
              })
              console.warn(
                'Failed to generate abstract with chatbot:',
                chatbotError,
              )
            }
          }
        } catch (e) {
          message.error('Failed to fetch queue question text.')
        }
      }
    }
    if (isOpen) {
      fetchQuestion()
    }
  }, [isOpen, qid, form, cid])

  const onFinish = async (values: {
    abstract: string
    body: string
    questionTypesInput: number[]
    getAIAnswer: boolean
  }) => {
    setIsLoading(true)

    const selectedQuestionTypes = (mergedQuestionTypes || []).filter((qt) =>
      (values.questionTypesInput || []).includes(qt.id),
    )

    const questionTypePayload: QuestionTypeParams[] = selectedQuestionTypes.map(
      (qt) => ({
        id: qt.id,
        name: qt.name,
        color: qt.color,
      }),
    )

    try {
      await API.asyncQuestions.create(
        {
          questionAbstract: values.abstract,
          questionText: values.body,
          questionTypes: questionTypePayload,
          status: values.getAIAnswer
            ? asyncQuestionStatus.AIAnswered
            : asyncQuestionStatus.AIAnsweredNeedsAttention,
        },
        cid,
      )

      const questions = await API.questions.index(qid)
      const myQuestion = questions.yourQuestions?.[0]
      if (myQuestion) {
        await API.questions.update(myQuestion.id, {
          status: ClosedQuestionStatus.ConfirmedDeleted,
        })
      }

      try {
        const alerts = await API.alerts.get(cid)
        const queueAlert = alerts.alerts?.find(
          (alert) =>
            alert.alertType === AlertType.PROMPT_STUDENT_TO_LEAVE_QUEUE &&
            (alert.payload as any)?.queueId === qid,
        )
        if (queueAlert) {
          await API.alerts.close(queueAlert.id)
        }
      } catch (alertError) {
        console.warn('Failed to close alert:', alertError)
      }

      message.success('Successfully converted your question!')
      handleClose()

      router.push(`/course/${cid}/queue/${qid}`)
    } catch (e) {
      const errorMessage = getErrorMessage(e)
      message.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal
      open={isOpen}
      onCancel={() => {
        localStorage.removeItem(`convertLoading_${cid}_${qid}`)
        onCancel?.()
        handleClose()
        router.push(`/course/${cid}/queue/${qid}`)
      }}
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
      okText="Post Anytime Question"
      cancelText="Cancel"
      okButtonProps={{
        autoFocus: true,
        htmlType: 'submit',
        loading: isLoading,
      }}
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
          form={form}
          layout="vertical"
          name="form_in_modal"
          onFinish={onFinish}
          initialValues={{ getAIAnswer: true }}
          clearOnDestroy
        >
          {dom}
        </Form>
      )}
    >
      <Form.Item
        name="abstract"
        label="Question Abstract (AI-Generated)"
        tooltip="An AI-generated short summary of your question. You can edit this if needed."
        required={true}
        rules={[
          { required: true, message: 'Please input a title!' },
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
        name="body"
        label="Question Body"
        tooltip="Full question text from the queue."
        required={true}
        rules={[{ required: true, message: 'Question body is required!' }]}
      >
        <Input.TextArea
          rows={4}
          placeholder="Your question text will appear here"
          autoSize={{ minRows: 3, maxRows: 6 }}
          allowClear
        />
      </Form.Item>
      <Form.Item
        name="questionTypesInput"
        label="What categories does your question fall under?"
      >
        <QuestionTagSelector questionTags={mergedQuestionTypes || []} />
      </Form.Item>
      <Tooltip title="An AI answer is automatically requested when converting a queue question.">
        <Form.Item
          name="getAIAnswer"
          valuePropName="checked"
          help="An AI will attempt to answer your question. A human will also be able to see your question and the AI's answer."
        >
          <Checkbox disabled>Get an AI answer</Checkbox>
        </Form.Item>
      </Tooltip>
    </Modal>
  )
}

export default ConvertQueueQToAnytimeQModal
