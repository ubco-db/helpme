import { toOrdinal } from '@/app/utils/generalUtils'
import {
  QuestionTypeParams,
  OpenQuestionStatus,
  Question,
  StudentAssignmentProgress,
  ConfigTasks,
  parseTaskIdsFromQuestionText,
} from '@koh/common'
import { Alert, Form, Modal } from 'antd'
import TaskSelector from '../TaskSelector'
import CenteredSpinner from '@/app/components/CenteredSpinner'

interface FormValues {
  taskIds: string[]
}

interface CreateDemoModalProps {
  configTasks: ConfigTasks
  studentAssignmentProgress: StudentAssignmentProgress | undefined
  open: boolean
  leaveQueue: () => void
  finishDemo: (
    text: string,
    questionType: QuestionTypeParams[],
    location: string,
    isTaskQuestion: boolean,
    groupable: boolean,
  ) => void
  onCancel: () => void
  question: Question | undefined
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
  position,
}) => {
  const drafting = question?.status === OpenQuestionStatus.Drafting
  const helping = question?.status === OpenQuestionStatus.Helping
  const [form] = Form.useForm()

  const onFinish = (values: FormValues) => {
    const newQuestionText = `Mark ${values.taskIds
      .map((task) => `"${task}"`)
      .join(' ')}`

    finishDemo(
      newQuestionText,
      [], // no question types for demos
      'In Person', // for now, all demos are in person
      true, //isTaskQuestion
      false, //groupable
    )
  }

  return (
    <Modal
      open={open}
      title={drafting ? 'Create Demo' : 'Edit Your Demo'}
      okText={drafting ? 'Finish' : 'Save Changes'}
      cancelText={drafting ? 'Leave Queue' : 'Cancel'}
      okButtonProps={{ autoFocus: true, htmlType: 'submit' }}
      cancelButtonProps={{
        danger: drafting,
        onClick: () => {
          if (drafting) {
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
          message={`A TA is coming to help you`}
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
