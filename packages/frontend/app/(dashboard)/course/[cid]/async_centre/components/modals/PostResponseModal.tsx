import { useEffect, useState } from 'react'
import Modal from 'antd/lib/modal/Modal'
import {
  Button,
  Checkbox,
  Divider,
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
  DeleteOutlined,
  EditOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import { deleteAsyncQuestion } from '../../utils/commonAsyncFunctions'
import { useCourseFeatures } from '@/app/hooks/useCourseFeatures'
import { useUserInfo } from '@/app/contexts/userContext'

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
  setCreateAsyncQuestionModalOpen: (val: boolean) => void
}

const PostResponseModal: React.FC<PostResponseModalProps> = ({
  open,
  question,
  onCancel,
  onPostResponse,
  courseId,
  setCreateAsyncQuestionModalOpen,
}) => {
  const { userInfo } = useUserInfo()
  const [form] = Form.useForm()
  const [isLoading, setIsLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [staffSetVisible, setStaffSetVisible] = useState<boolean>(
    (question.staffSetVisible == null && question.authorSetVisible) ||
      !!question.staffSetVisible,
  )
  const [visiblePopConfirmVisible, setVisiblePopConfirmVisible] =
    useState<boolean>(false)
  const courseFeatures = useCourseFeatures(courseId)
  const authorCanSetVisible = courseFeatures?.asyncCentreAuthorPublic ?? false

  const [hasCheckedPopconfirm, setHasCheckedPopconfirm] =
    useState<boolean>(!authorCanSetVisible)
  const [confirmPopoverOpen, setConfirmPopoverOpen] = useState(false)

  useEffect(() => {
    setStaffSetVisible(
      (question.staffSetVisible == null && question.authorSetVisible) ||
        !!question.staffSetVisible,
    )
  }, [question.authorSetVisible, question.staffSetVisible])

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
        <div className={'flex flex-col gap-1'}>
          {question.creator.id == userInfo.id && (
            <div className={'flex flex-col gap-1 md:hidden'}>
              <Divider className={'text-gray-500'}>Actions</Divider>
              <div className={'flex flex-row justify-between gap-1'}>
                <DeleteButton
                  question={question}
                  deleteLoading={deleteLoading}
                  setDeleteLoading={setDeleteLoading}
                  deleteAsyncQuestion={deleteAsyncQuestion}
                  onPostResponse={onPostResponse}
                />
                {question.creator.id == userInfo.id && (
                  <Button
                    className="inline-flex flex-auto md:hidden"
                    type="primary"
                    icon={<EditOutlined />}
                    onClick={() => setCreateAsyncQuestionModalOpen(true)}
                  >
                    {' '}
                    Edit
                  </Button>
                )}
              </div>
              <Divider className={'text-gray-500'} orientation={'right'}>
                Post Response
              </Divider>
            </div>
          )}
          <div className={'flex justify-between gap-2'}>
            {question.creator.id != userInfo.id ? (
              <div className={'w-min'}>
                <DeleteButton
                  question={question}
                  deleteLoading={deleteLoading}
                  setDeleteLoading={setDeleteLoading}
                  deleteAsyncQuestion={deleteAsyncQuestion}
                  onPostResponse={onPostResponse}
                />
              </div>
            ) : (
              <div></div>
            )}
            <div className="flex justify-end gap-2">
              <CancelBtn />
              <OkBtn />
              <Popconfirm
                className={'max-w-32 md:max-w-48'}
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

type DeleteButtonProps = {
  question: AsyncQuestion
  deleteLoading: boolean
  setDeleteLoading: (val: boolean) => void
  deleteAsyncQuestion: (
    id: number,
    isStaff: boolean,
    successFunction: () => void,
  ) => Promise<void>
  onPostResponse: () => void
}

const DeleteButton: React.FC<DeleteButtonProps> = ({
  question,
  deleteLoading,
  setDeleteLoading,
  deleteAsyncQuestion,
  onPostResponse,
}) => {
  return (
    <Popconfirm
      className={'inline-flex flex-auto md:hidden'}
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
        Delete
      </Button>
    </Popconfirm>
  )
}
