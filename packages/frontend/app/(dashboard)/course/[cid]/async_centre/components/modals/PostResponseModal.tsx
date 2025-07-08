import { useState } from 'react'
import Modal from 'antd/lib/modal/Modal'
import {
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
import { DeleteOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import { deleteAsyncQuestion } from '../../utils/commonAsyncFunctions'
import { useCourseFeatures } from '@/app/hooks/useCourseFeatures'

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
  courseId: number
}

const PostResponseModal: React.FC<PostResponseModalProps> = ({
  open,
  question,
  onCancel,
  onPostResponse,
  courseId,
}) => {
  const [form] = Form.useForm()
  const [isLoading, setIsLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [staffSetVisible, setStaffSetVisible] = useState<boolean>(
    !!question.staffSetVisible,
  )
  const [visiblePopConfirmVisible, setVisiblePopConfirmVisible] =
    useState<boolean>(false)
  const courseFeatures = useCourseFeatures(courseId)
  const authorCanSetVisible = courseFeatures?.asyncCentreAuthorPublic ?? false

  const [hasCheckedPopconfirm, setHasCheckedPopconfirm] =
    useState<boolean>(!authorCanSetVisible)
  const [confirmPopoverOpen, setConfirmPopoverOpen] = useState(false)

  const onFinish = async () => {
    setHasCheckedPopconfirm(false)
    const values: FormValues = await form.validateFields()
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
        staffSetVisible: staffSetVisible,
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
        onClick: async () => {
          await form.validateFields().then(() => {
            if (
              authorCanSetVisible &&
              !hasCheckedPopconfirm &&
              question.authorSetVisible != staffSetVisible
            ) {
              setConfirmPopoverOpen(true)
            } else {
              onFinish()
            }
          })
        },
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
            <Popconfirm
              title="Are you sure you want to override visibility?"
              description={
                question.authorSetVisible
                  ? 'The student who created this question wanted it to be visible to other students.'
                  : 'The student who created this question did not want for it to be visible to other students.'
              }
              open={confirmPopoverOpen}
              arrow={false}
              okText="Yes"
              cancelText="No"
              onConfirm={() => {
                onFinish().then()
                setConfirmPopoverOpen(false)
              }}
              onCancel={() => setConfirmPopoverOpen(false)}
            ></Popconfirm>
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
            verified: question.verified,
          }}
          clearOnDestroy
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
      <Form.Item
        label={
          <div className="flex flex-row items-center gap-1">
            Set question visible to all students
            <Tooltip title="Questions can normally only be seen by staff and the student who asked it. This will make it visible to all students.">
              <QuestionCircleOutlined style={{ color: 'gray' }} />
            </Tooltip>
          </div>
        }
        layout="horizontal"
        valuePropName="checked"
      >
        {authorCanSetVisible ? (
          <Popconfirm
            title="Are you sure you want to override visibility?"
            description={
              question.authorSetVisible
                ? 'The student who created this question wanted it to be visible to other students.'
                : 'The student who created this question did not want for it to be visible to other students.'
            }
            okText="Override"
            cancelText="Leave as is"
            onConfirm={() => {
              setStaffSetVisible(!staffSetVisible)
              setVisiblePopConfirmVisible(false)
              setHasCheckedPopconfirm(true)
            }}
            onCancel={() => {
              setVisiblePopConfirmVisible(false)
              setHasCheckedPopconfirm(true)
            }}
            open={visiblePopConfirmVisible}
          >
            <Switch
              onClick={() => {
                if (
                  (question.authorSetVisible && staffSetVisible) ||
                  (!question.authorSetVisible && !staffSetVisible)
                )
                  setVisiblePopConfirmVisible(true)
                else setStaffSetVisible(!staffSetVisible)
              }}
              checked={staffSetVisible}
              checkedChildren="Visible"
              unCheckedChildren="Hidden"
            />
          </Popconfirm>
        ) : (
          <Switch
            onClick={() => setStaffSetVisible((prev) => !prev)}
            checked={staffSetVisible}
            checkedChildren="Visible"
            unCheckedChildren="Hidden"
          />
        )}
      </Form.Item>
      <Form.Item name="verified" valuePropName="checked">
        <Checkbox>Mark as verified by faculty</Checkbox>
      </Form.Item>
    </Modal>
  )
}

export default PostResponseModal
