import { useState } from 'react'
import Modal from 'antd/lib/modal/Modal'
import { Input, Form, message, Switch, Checkbox } from 'antd'
import { AsyncQuestion, asyncQuestionStatus } from '@koh/common'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { API } from '@/app/api'

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

  const onFinish = async (values: FormValues) => {
    setIsLoading(true)
    // if the answer text is the same as the current answer text and the status is AIAnswered, AIAnsweredNeedsAttention, or AIAnsweredResolved, then the status should remain the same
    // unless the TA changes the verified status to true, then it will always be HumanAnswered (displayed as Human Verified)
    const newStatus =
      question.answerText === values.answerText && !values.verified
        ? question.status in
          [
            asyncQuestionStatus.AIAnswered,
            asyncQuestionStatus.AIAnsweredNeedsAttention,
            asyncQuestionStatus.AIAnsweredResolved,
          ]
          ? question.status
          : asyncQuestionStatus.HumanAnswered
        : asyncQuestionStatus.HumanAnswered
    await API.asyncQuestions
      .update(question.id, {
        answerText: values.answerText,
        visible: values.visible,
        status: newStatus,
        verified: values.verified,
      })
      .then(() => {
        message.success('Response Successfully Posted/Edited')
        onPostResponse()
      })
      .catch((e) => {
        const errorMessage = getErrorMessage(e)
        message.error('Error posting response:', errorMessage)
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
      <Form.Item
        name="visible"
        label="Set question visible to all students"
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
