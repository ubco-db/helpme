import {
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  message,
  Tooltip,
  Tag,
} from 'antd'
import { useEffect, useState } from 'react'
import { API } from '@/app/api'
import { getBrightness, getErrorMessage } from '@/app/utils/generalUtils'
import {
  ClosedQuestionStatus,
  QuestionTypeParams,
  asyncQuestionStatus,
  nameToRGB,
  IQuestion,
  IQueue,
  QuestionType,
  IAsyncQuestion,
  showRemove,
} from '@koh/common'
import { useQuestionTypes } from '@/app/hooks/useQuestionTypes'
import { QuestionTagSelector } from '../../../components/QuestionTagElement'
import tinycolor from 'tinycolor2'
import { QuestionCircleOutlined } from '@ant-design/icons'
import { CustomTagSelector } from '../../../components/CustomTagSelector'
import { useCourse } from '@/app/hooks/useCourse'

type ConvertQueueQToAnytimeQModalProps = {
  isOpen: boolean
  handleClose: () => void
  cid: number
  qid: number
}

const ConvertQueueQToAnytimeQModal: React.FC<
  ConvertQueueQToAnytimeQModalProps
> = ({ isOpen, handleClose, cid, qid }) => {
  const [form] = Form.useForm()
  const [isLoading, setIsLoading] = useState(false)
  const [questionTypes] = useQuestionTypes(cid, qid)
  const { color } = useCourse()

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

    const existingTag = (questionTypes || []).find((qt) => qt.name === label)
    const tagColor = existingTag
      ? existingTag.color
      : nameToRGB(label as string)
    const textColor = getBrightness(tagColor) < 128 ? 'white' : 'black'

    return (
      <Tag color={color.hex} style={{ marginRight: 3 }}>
        {label}
      </Tag>
    )
  }

  useEffect(() => {
    const fetchQuestion = async () => {
      if (qid) {
        try {
          const questions = await API.questions.index(qid)
          const myQuestion = questions.yourQuestions?.[0]
          if (myQuestion?.text) {
            form.setFieldsValue({
              abstract: myQuestion.text.substring(0, 100),
              body: myQuestion.text.length > 100 ? myQuestion.text : '',
            })
          }
        } catch (e) {
          message.error('Failed to fetch queue question text.')
        }
      }
    }
    if (isOpen) {
      fetchQuestion()
    }
  }, [isOpen, qid, form])

  const onFinish = async (values: any) => {
    setIsLoading(true)
    const { abstract, body, questionTypesInput, customTags } = values

    let finalQuestionText = body || ''
    if (customTags && customTags.length > 0) {
      const tagString = customTags.map((t: string) => `#${t}`).join(' ')
      finalQuestionText = `${finalQuestionText}\n\n[Custom Tags]: ${tagString}`
    }

    const questionTypePayload: QuestionTypeParams[] = (questionTypes || [])
      .filter((qt) => questionTypesInput.includes(qt.id))
      .map((qt) => ({ id: qt.id, name: qt.name, color: qt.color }))

    try {
      await API.asyncQuestions.create(
        {
          questionAbstract: abstract,
          questionText: finalQuestionText,
          questionTypes: questionTypePayload,
          status: asyncQuestionStatus.AIAnswered,
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

      message.success('Successfully converted your question!')
      handleClose()
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
      onCancel={handleClose}
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
        label="Question Abstract"
        tooltip="A short summary/description of the question (or the question itself)."
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
          placeholder="A short summary of your question"
          count={{
            show: true,
            max: 100,
          }}
        />
      </Form.Item>
      <Form.Item
        name="body"
        label="Question Body (Optional)"
        tooltip="Your full question text. The placeholder text is just an example."
      >
        <Input.TextArea
          rows={4}
          placeholder="Add more details here"
          autoSize={{ minRows: 3, maxRows: 6 }}
          allowClear
        />
      </Form.Item>
      <Form.Item name="questionTypesInput" label="Tags" initialValue={[]}>
        <QuestionTagSelector questionTags={questionTypes || []} />
      </Form.Item>
      <Form.Item name="customTags" label="Custom Tags" initialValue={[]}>
        <CustomTagSelector />
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
