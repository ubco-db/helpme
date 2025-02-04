import { toOrdinal } from '@/app/utils/generalUtils'
import {
  QuestionTypeParams,
  OpenQuestionStatus,
  Question,
  StudentAssignmentProgress,
  ConfigTasks,
  parseTaskIdsFromQuestionText,
  QuestionLocations,
} from '@koh/common'
import { Alert, Form, Modal } from 'antd'
import TaskSelector from '../TaskSelector'
import { useEffect, useState } from 'react'

interface FormValues {
  taskIds: string[]
}

interface CreateDemoModalProps {
  configTasks: ConfigTasks
  studentAssignmentProgress: StudentAssignmentProgress | undefined
  open: boolean
  leaveQueue: () => Promise<void>
  finishDemo: (
    text: string,
    questionType: QuestionTypeParams[],
    location: QuestionLocations,
    isTaskQuestion: boolean,
    groupable: boolean,
  ) => void
  onCancel: () => void
  question: Question | undefined
  setIsCreateDemoModalLoading: (loading: boolean) => void
  position?: number
}

const CreateDemoModal: React.FC<CreateDemoModalProps> = ({
  configTasks,
  studentAssignmentProgress,
  open,
  leaveQueue,
  finishDemo,
  onCancel,
  question,
  setIsCreateDemoModalLoading,
  position,
}) => {
  const drafting = question?.status === OpenQuestionStatus.Drafting
  const helping = question?.status === OpenQuestionStatus.Helping
  const [form] = Form.useForm()
  const [isLeaveButtonLoading, setIsLeaveButtonLoading] = useState(false)

  const onFinish = (values: FormValues) => {
    const newQuestionText = `Mark ${values.taskIds
      .map((task) => `"${task}"`)
      .join(' ')}`

    finishDemo(
      newQuestionText,
      [], // no question types for demos
      'In-Person', // for now, all demos are in person
      true, //isTaskQuestion
      false, //groupable
    )
  }

  useEffect(() => {
    if (open) {
      // Need to put this loading toggle inside the modal so that the Create Demo button stops loading once the modal is rendered
      setIsCreateDemoModalLoading(false)
    }
  }, [setIsCreateDemoModalLoading, open])

  return (
    <Modal
      open={open}
      title={drafting ? 'Create Demo' : 'Edit Your Demo'}
      okText={drafting ? 'Finish' : 'Save Changes'}
      cancelText={drafting ? 'Leave Queue' : 'Cancel'}
      okButtonProps={{ autoFocus: true, htmlType: 'submit' }}
      cancelButtonProps={{
        danger: drafting,
        loading: isLeaveButtonLoading,
        onClick: async () => {
          if (drafting) {
            setIsLeaveButtonLoading(true)
            await leaveQueue()
            setIsLeaveButtonLoading(false)
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
                taskIds: drafting
                  ? []
                  : parseTaskIdsFromQuestionText(question.text),
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
          description="Your spot in queue has been temporarily reserved. Please select what parts you want checked to finish joining the queue."
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
      {Object.keys(configTasks).length > 0 ? (
        <Form.Item
          name="taskIds"
          label="What parts are being checked?"
          rules={[
            {
              required: true,
              message: 'Please select at least one task',
            },
          ]}
        >
          <TaskSelector
            studentAssignmentProgress={studentAssignmentProgress}
            configTasks={configTasks}
          />
        </Form.Item>
      ) : (
        <p>No Tasks Found. Please let your TA/Prof know of this issue</p>
      )}
    </Modal>
  )
}

export default CreateDemoModal
