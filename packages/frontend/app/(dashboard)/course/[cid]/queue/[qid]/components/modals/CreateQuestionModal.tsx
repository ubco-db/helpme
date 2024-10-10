import { useLocalStorage } from '@/app/hooks/useLocalStorage'
import { useQuestionTypes } from '@/app/hooks/useQuestionTypes'
import { QuestionTypeParams, OpenQuestionStatus, Question } from '@koh/common'
import { Alert, Form, Modal, Radio } from 'antd'
import { QuestionTagSelector } from '../../../../components/QuestionTagElement'
import { toOrdinal } from '@/app/utils/generalUtils'
import TextArea from 'antd/es/input/TextArea'

interface CreateQuestionModalProps {
  queueId: number
  courseId: number
  open: boolean
  leaveQueue: () => void
  finishQuestion: (
    text: string,
    questionTypes: QuestionTypeParams[] | undefined,
    location: string,
    isTaskQuestion: boolean,
    groupable: boolean,
  ) => void
  onCancel: () => void
  question: Question | undefined
  position?: number
  minTags?: number
}

interface FormValues {
  questionTypesInput: number[]
  questionText: string
  location: 'In Person' | 'Online'
}

const CreateQuestionModal: React.FC<CreateQuestionModalProps> = ({
  queueId,
  courseId,
  open,
  leaveQueue,
  finishQuestion,
  onCancel,
  question,
  position,
  minTags = 0,
}) => {
  const drafting = question?.status === OpenQuestionStatus.Drafting
  const helping = question?.status === OpenQuestionStatus.Helping
  const [questionTypes] = useQuestionTypes(courseId, queueId)

  const [
    storedDraftQuestion,
    setStoredDraftQuestion,
    deleteStoredDraftQuestion,
  ] = useLocalStorage<FormValues>('draftQuestion', null)

  const [form] = Form.useForm()
  const onFinish = (values: FormValues) => {
    const newQuestionTypeInput =
      values.questionTypesInput && questionTypes
        ? questionTypes.filter((questionType) =>
            values.questionTypesInput.includes(questionType.id),
          )
        : []

    finishQuestion(
      values.questionText,
      newQuestionTypeInput,
      values.location,
      false, //isTaskQuestion
      false, //groupable
    )
    deleteStoredDraftQuestion()
  }

  return (
    <Modal
      open={open}
      title={drafting ? 'Describe your question' : 'Edit your question'}
      okText={drafting ? 'Finish' : 'Save Changes'}
      cancelText={drafting ? 'Leave Queue' : 'Cancel'}
      okButtonProps={{ autoFocus: true, htmlType: 'submit' }}
      cancelButtonProps={{
        danger: drafting,
        onClick: () => {
          if (drafting) {
            deleteStoredDraftQuestion()
            leaveQueue()
          } else {
            onCancel()
          }
        },
      }}
      onCancel={onCancel}
      destroyOnClose
      loading={!question}
      modalRender={(dom) => {
        if (!question) {
          return <>{dom}</>
        } else {
          return (
            <Form
              layout="vertical"
              form={form}
              name="form_in_modal"
              initialValues={{
                questionTypesInput: drafting
                  ? storedDraftQuestion?.questionTypesInput
                  : question.questionTypes?.map((type) => type.id),
                questionText: drafting
                  ? storedDraftQuestion?.questionText
                  : question.text,
                location: drafting
                  ? storedDraftQuestion?.location
                  : question.location,
              }}
              onValuesChange={(changedValues, values) => {
                setStoredDraftQuestion(values)
              }}
              clearOnDestroy
              onFinish={(values) => onFinish(values)}
            >
              {dom}
            </Form>
          )
        }
      }}
    >
      {drafting && (
        <Alert
          className="mb-4"
          message={`You are currently ${position ? toOrdinal(position) : ''} in queue`}
          description="Your spot in queue has been temporarily reserved. Please describe your question to finish joining the queue."
          type="success"
          showIcon
        />
      )}
      {helping && (
        <Alert
          className="mb-4"
          message={`A TA is ready for you now`}
          description="Please click 'Save Changes' to submit what you've filled out"
          type="info"
          showIcon
        />
      )}
      {questionTypes && questionTypes.length > 0 && (
        <Form.Item
          name="questionTypesInput"
          label="What categories does your question fall under?"
          rules={[
            ...(minTags > 0
              ? [
                  {
                    required: true,
                    message:
                      minTags == 1 ? 'Please select at least one tag' : '',
                  },
                ]
              : []),
            {
              type: 'array',
              min: minTags,
              message: `Please select at least ${minTags} tags`,
            },
          ]}
        >
          <QuestionTagSelector questionTags={questionTypes} />
        </Form.Item>
      )}
      <Form.Item
        name="questionText"
        label="What do you need help with?"
        extra={
          <div
            className="mb-8 text-sm text-gray-500"
            id="question-form-text-caption"
          >
            Be as descriptive and specific as possible in your answer. Your name
            will be hidden to other students, but your question will be visible
            so don&apos;t frame your question in a way that gives away the
            answer.
          </div>
        }
      >
        <TextArea
          placeholder="I’m having trouble understanding list abstractions, particularly in Assignment 5."
          autoSize={{ minRows: 3, maxRows: 6 }}
          aria-describedby="question-form-text-caption"
          allowClear
        />
      </Form.Item>

      {/* TODO: change this to only be an option if the queue is hybrid. Strictly in-person or online queues should not have this option */}
      <Form.Item name="location" label="Are you joining the queue in-person?">
        <Radio.Group className="mb-1">
          <Radio value="In Person">Yes</Radio>
          <Radio value="Online">No</Radio>
        </Radio.Group>
      </Form.Item>
    </Modal>
  )
}

export default CreateQuestionModal
