import { useState } from 'react'
import Modal from 'antd/lib/modal/Modal'
import {
  Input,
  Form,
  message,
  Switch,
  Checkbox,
  Button,
  Popconfirm,
  Tooltip,
} from 'antd'
import { AsyncQuestion, asyncQuestionStatus } from '@koh/common'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { API } from '@/app/api'
import {
  DeleteOutlined,
  QuestionCircleOutlined,
  RollbackOutlined,
} from '@ant-design/icons'
import { deleteAsyncQuestion } from '../../utils/commonAsyncFunctions'
import SourceLinkCitations from '../../../components/chatbot/SourceLinkCitations'

interface FormValues {
  answerText: string
  visible: boolean
  verified: boolean
}

interface PostResponseModalProps {
  open: boolean
  onCancel: () => void
  onPostResponse: () => void
  question: AsyncQuestion
}

const PostResponseModal: React.FC<PostResponseModalProps> = ({
  open,
  question,
  onCancel,
  onPostResponse,
}) => {
  const [form] = Form.useForm()
  const [isLoading, setIsLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [saveToChatbot, setSaveToChatbot] = useState(true)
  const [deleteCitations, setDeleteCitations] = useState(false) // put into state rather than FormValues since we need to change(re-render) how the source links appear when toggled

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
        visible: values.visible,
        status: newStatus,
        verified: values.verified,
        saveToChatbot: saveToChatbot,
        deleteCitations: deleteCitations,
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
      okText="Finish Changes"
      cancelText="Cancel"
      cancelButtonProps={{
        className: 'w-24',
      }}
      width={{
        xs: '100%',
        sm: '100%',
        md: '100%',
        lg: '60%',
        xl: '50%',
        xxl: '35%',
      }}
      okButtonProps={{
        autoFocus: true,
        htmlType: 'submit',
        loading: isLoading,
      }}
      onCancel={onCancel}
      // display delete button for mobile in footer
      footer={(_, { OkBtn, CancelBtn }) => (
        <div className="flex items-end justify-between gap-2">
          <div className="flex flex-col items-center justify-center gap-2">
            <Popconfirm
              className="inline-flex md:hidden"
              title="Are you sure you want to delete this question?"
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
            <CancelBtn />
          </div>
          <div className="flex flex-col items-center justify-center gap-2 rounded-md bg-blue-100 p-1 px-2">
            <OkBtn />
            <Checkbox
              checked={saveToChatbot}
              onChange={(e) => setSaveToChatbot(e.target.checked)}
              // checkboxes will automatically put its children into a span with some padding, so this targets it to get rid of the padding
              className="[&>span]:!pr-0"
            >
              <Tooltip
                placement="bottom"
                title="Keeping this enabled will insert this question and answer as a new Chatbot Document Chunk (or update existing), effectively allowing the chatbot to reference it in future answers. Please consider disabling this if the question contains private information."
              >
                <span className="pb-2">
                  Save to Chatbot
                  <QuestionCircleOutlined className="ml-1 text-gray-500" />
                </span>
              </Tooltip>
            </Checkbox>
          </div>
        </div>
      )}
      destroyOnClose
      modalRender={(dom) => (
        <Form
          layout="vertical"
          form={form}
          name="form_in_modal"
          initialValues={{
            answerText: question.answerText,
            visible: question.visible,
            verified: question.verified,
          }}
          // clearOnDestroy
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
          allowClear={{
            clearIcon: (
              <Tooltip title="Revert to original answer">
                <RollbackOutlined />
              </Tooltip>
            ),
          }}
          onClear={() => {
            form.setFieldsValue({
              answerText: question.answerText,
            })
          }}
        />
      </Form.Item>
      {question.citations && question.citations.length > 0 && (
        <Form.Item
          label="Document citations"
          tooltip="These source document citations were retrieved when the question first got an AI answer. You may choose to delete them (doing so will only delete the citations themselves, the original source documents will remain unchanged)"
          layout="horizontal"
        >
          <div className="flex flex-wrap gap-2 rounded-md p-2 outline-dashed outline-1 outline-gray-300">
            <SourceLinkCitations
              sourceDocuments={question.citations}
              chatbotQuestionType={'Course'}
              appearDeleted={deleteCitations}
            />
            <Form.Item
              name="deleteCitations"
              label="Delete citations"
              valuePropName="checked"
              layout="horizontal"
              className="mb-0"
            >
              <Checkbox
                onChange={(e) => setDeleteCitations(e.target.checked)}
              />
            </Form.Item>
          </div>
        </Form.Item>
      )}
      <Form.Item
        name="visible"
        tooltip="Questions can normally only be seen by staff and the student who asked it. This will make it visible to all students (the student themselves will appear anonymous to other students)"
        label="Set question visible to all students"
        valuePropName="checked"
        layout="horizontal"
      >
        <Switch checkedChildren="Visible" unCheckedChildren="Hidden" />
      </Form.Item>
      <Form.Item
        name="verified"
        valuePropName="checked"
        label="Mark as verified by faculty"
        layout="horizontal"
      >
        <Checkbox />
      </Form.Item>
    </Modal>
  )
}

export default PostResponseModal
