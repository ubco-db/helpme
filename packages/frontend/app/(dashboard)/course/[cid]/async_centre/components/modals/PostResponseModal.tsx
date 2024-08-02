import { useState } from 'react'
import Modal from 'antd/lib/modal/Modal'
import { Input, Form, message, Switch, Checkbox } from 'antd'
import { AsyncQuestion, asyncQuestionStatus } from '@koh/common'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { API } from '@/app/api'
import { useAsnycQuestions } from '@/app/hooks/useAsyncQuestions'

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
    if (!question.id) return // this should never happen, just doing this to get rid of typescript error. TODO: Actual fix is to make AsyncQuestion not used for both creating questions and updating them. Make an CreateAsyncQuestionParams
    setIsLoading(true)
    await API.asyncQuestions
      .update(question.id, {
        answerText: values.answerText,
        visible: values.visible,
        status: asyncQuestionStatus.HumanAnswered,
        verified: values.verified,
      })
      .then(() => {
        message.success('Response Successfully Posted/Edited')
        setIsLoading(false)
        onPostResponse()
      })
      .catch((e) => {
        const errorMessage = getErrorMessage(e)
        message.error('Error posting response:', errorMessage)
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
