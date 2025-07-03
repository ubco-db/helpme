import { useState } from 'react'
import Modal from 'antd/lib/modal/Modal'
import {
  Alert,
  Button,
  Checkbox,
  Form,
  Input,
  message,
  Popconfirm,
  Switch,
  Tooltip,
} from 'antd'
import { AsyncQuestion, asyncQuestionStatus } from '@koh/common'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { API } from '@/app/api'
import {
  CheckCircleOutlined,
  DeleteOutlined,
  QuestionCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { deleteAsyncQuestion } from '../../utils/commonAsyncFunctions'

interface FormValues {
  answerText: string
  staffSetVisible: boolean
  verified: boolean
}

interface PostResponseModalProps {
  open: boolean
  onCancel: () => void
  onPostResponse: () => void
  question: AsyncQuestion
  asyncCentreAllowPublic: boolean
}

const PostResponseModal: React.FC<PostResponseModalProps> = ({
  open,
  question,
  onCancel,
  onPostResponse,
  asyncCentreAllowPublic,
}) => {
  const [form] = Form.useForm()
  const [isLoading, setIsLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const onFinish = async (values: FormValues) => {
    setIsLoading(true)
    // if the answer text is the same as the current answer text and the status is AIAnswered, AIAnsweredNeedsAttention, or AIAnsweredResolved, then the status should remain the same
    // unless the TA changes the verified status to true, then it will always be HumanAnswered (displayed as Human Verified)
    const newStatus =
      question.answerText === values.answerText && !values.verified
        ? [
            asyncQuestionStatus.AIAnswered,
            asyncQuestionStatus.AIAnsweredNeedsAttention,
            asyncQuestionStatus.AIAnsweredResolved,
          ].includes(question.status)
          ? question.status
          : asyncQuestionStatus.HumanAnswered
        : asyncQuestionStatus.HumanAnswered
    await API.asyncQuestions
      .facultyUpdate(question.id, {
        answerText: values.answerText,
        staffSetVisible: values.staffSetVisible,
        status: newStatus,
        verified: values.verified,
      })
      .then(() => {
        message.success('Response Successfully Posted/Edited')
        onPostResponse()
      })
      .catch((e) => {
        const errorMessage = getErrorMessage(e)
        message.error('Error posting response:' + errorMessage)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  return (
    <Modal
      open={open}
      title="Post/Edit response to Student question"
      okText="Finish"
      cancelText="Cancel"
      okButtonProps={{
        autoFocus: true,
        htmlType: 'submit',
        loading: isLoading,
      }}
      onCancel={onCancel}
      // display delete button for mobile in footer
      footer={(_, { OkBtn, CancelBtn }) => (
        <div className="flex justify-between md:justify-end">
          <Popconfirm
            className="inline-flex md:hidden"
            title="Are you sure you want to delete the question?"
            okText="Yes"
            cancelText="No"
            getPopupContainer={(trigger) => trigger.parentNode as HTMLElement}
            okButtonProps={{ loading: deleteLoading }}
            onConfirm={async () => {
              setDeleteLoading(true)
              await deleteAsyncQuestion(question.id, true, onPostResponse)
              setDeleteLoading(false)
            }}
          >
            <Button danger type="primary" icon={<DeleteOutlined />}>
              {' '}
              Delete Question{' '}
            </Button>
          </Popconfirm>
          <div className="flex gap-2">
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
            answerText: question.answerText,
            staffSetVisible: question.staffSetVisible,
            verified: question.verified,
          }}
          clearOnDestroy
          onFinish={(values) => onFinish(values)}
        >
          {dom}
        </Form>
      )}
    >
      <Form.Item
        name="answerText"
        label="Answer Text"
        rules={[{ required: true, message: 'Please input your response.' }]}
      >
        <Input.TextArea
          placeholder="Your response to the question"
          autoSize={{ minRows: 3, maxRows: 15 }}
          allowClear
        />
      </Form.Item>
      {asyncCentreAllowPublic && (
        <Alert
          icon={
            question.authorSetVisible ? (
              <CheckCircleOutlined />
            ) : (
              <WarningOutlined />
            )
          }
          type={question.authorSetVisible ? 'success' : 'warning'}
          message={'Visibility Setting'}
          description={
            question.authorSetVisible
              ? 'The student who created this question opted for it to be visible to other students.'
              : 'The student who created this question did not opt for it to be visible to other students.'
          }
        />
      )}
      <Form.Item
        name="staffSetVisible"
        label={
          <div className="flex flex-row items-center gap-1">
            Set question visible to all students
            <Tooltip title="Questions can normally only be seen by staff and the student who asked it. This will make it visible to all students as long as the author also sets it to be visible.">
              <QuestionCircleOutlined style={{ color: 'gray' }} />
            </Tooltip>
          </div>
        }
        layout="horizontal"
        valuePropName="checked"
      >
        <Switch checkedChildren="Visible" unCheckedChildren="Hidden" />
      </Form.Item>
      <Form.Item name="verified" valuePropName="checked">
        <Checkbox>Mark as verified by faculty</Checkbox>
      </Form.Item>
    </Modal>
  )
}

export default PostResponseModal
