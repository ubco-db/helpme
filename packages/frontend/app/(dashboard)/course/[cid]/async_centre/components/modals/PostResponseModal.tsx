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
} from 'antd'
import { AsyncQuestion, asyncQuestionStatus } from '@koh/common'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { API } from '@/app/api'
import { DeleteOutlined } from '@ant-design/icons'
import { useUserInfo } from '@/app/contexts/userContext'
import { useParams } from 'next/navigation'
import { deleteAsyncQuestion } from '../../utils/commonAsyncFunctions'
import axios from 'axios'

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
  const { userInfo } = useUserInfo()
  const [form] = Form.useForm()
  const [isLoading, setIsLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const params = useParams<{ cid: string }>()
  const cid = params.cid

  const onFinish = async (values: FormValues) => {
    setIsLoading(true)

    // Determine the new status based on the answer text and verified status
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

    try {
      // Update the question status and other information
      await API.asyncQuestions.facultyUpdate(question.id, {
        answerText: values.answerText,
        visible: values.visible,
        status: newStatus,
        verified: values.verified,
      })

      message.success('Response Successfully Posted/Edited')

      // If the status was AIAnswered and is now HumanAnswered, send the data to documentChunk
      if (
        question.status !== asyncQuestionStatus.HumanAnswered &&
        newStatus === asyncQuestionStatus.HumanAnswered
      ) {
        const metadata: any = {
          name: 'Manually Verified Answer',
          type: 'inserted_async',
        }

        // Send the updated document chunk
        const response = await axios.post(
          `/chat/${cid}/documentChunk`,
          {
            documentText: values.answerText, // Send the updated answer
            metadata: metadata,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              HMS_API_TOKEN: userInfo.chat_token.token,
            },
          },
        )

        if (response.status === 200) {
          message.success('Document added successfully.')
        } else {
          throw new Error('Failed to add documentChunk')
        }
      }

      // After successfully posting the response
      onPostResponse()
    } catch (e) {
      const errorMessage = getErrorMessage(e)
      message.error('Error posting response: ' + errorMessage)
    } finally {
      setIsLoading(false)
    }
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
