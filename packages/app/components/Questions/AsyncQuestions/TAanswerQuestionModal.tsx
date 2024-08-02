import { ReactElement, useEffect, useState } from 'react'
import Modal from 'antd/lib/modal/Modal'
import { Input, Form, Button, message, Switch } from 'antd'
import { API } from '@koh/api-client'
import { AsyncQuestion, asyncQuestionStatus } from '@koh/common'
import { default as React } from 'react'
import { useAsnycQuestions } from '../../../hooks/useAsyncQuestions'
import { useRouter } from 'next/router'

interface EditQueueModalProps {
  visible: boolean
  onClose: () => void
  question: AsyncQuestion
}

export function AnswerQuestionModal({
  visible,
  question,
  onClose,
}: EditQueueModalProps): ReactElement {
  const [form] = Form.useForm()
  const [visibleStatus, setVisibleStatus] = useState(false)
  const router = useRouter()
  const { cid } = router.query
  const { mutateQuestions } = useAsnycQuestions(Number(cid))
  //use questions for form validation
  useEffect(() => {
    form.setFieldsValue(question)
  }, [question])
  const postReponse = async (value) => {
    await API.asyncQuestions
      .update(question.id, {
        answerText: value.answerText,
        visible: visibleStatus,
        status: asyncQuestionStatus.HumanAnswered,
        verified: value.verified,
      })
      .then((value) => {
        if (value) {
          message.success('Response posted/edited')
          mutateQuestions()
        } else {
          message.error("Couldn't post response")
        }
      })
  }
  return (
    <Modal
      title="Post/Edit response to Student question"
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="back" onClick={onClose}>
          Return
        </Button>,
        <Button
          key="submit"
          type="primary"
          onClick={async () => {
            const value = await form.validateFields()
            postReponse(value)
            onClose()
          }}
        >
          Submit
        </Button>,
      ]}
    >
      <span>
        <h3>Question:</h3>
        <p>
          <strong>{question.questionAbstract}</strong>
        </p>
        <p> {question.questionText}</p>
        <br></br>
      </span>
      <br></br>
      <h3>Response:</h3>
      <Form
        form={form}
        initialValues={{
          answerText: question.answerText,
          visible: question.visible,
        }}
      >
        <Form.Item
          name="visible"
          label="Set question visible to all students"
          valuePropName="checked"
        >
          <Switch
            checkedChildren="visible"
            unCheckedChildren="hidden"
            onChange={(checked) => setVisibleStatus(checked)}
          />
        </Form.Item>
        <Form.Item
          name="verified"
          label="Mark as verified by faculty"
          valuePropName="checked"
        >
          <Switch checkedChildren="verified" unCheckedChildren="unverified" />
        </Form.Item>
        <Form.Item
          name="answerText"
          rules={[{ required: true, message: 'Please input your response.' }]}
        >
          <Input.TextArea
            style={{ height: 150, marginBottom: 24 }}
            placeholder={'Your response to the question'}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
