import { Button, Checkbox, Form, Input, Modal, message } from 'antd'
import { useEffect, useState } from 'react'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { ClosedQuestionStatus } from '@koh/common'

type ConvertQueueQToAnytimeQModalProps = {
  isOpen: boolean
  handleClose: () => void
  cid: number
  qid: number
}

const ConvertQueueQToAnytimeQModal: React.FC<
  ConvertQueueQToAnytimeQModalProps
> = ({ isOpen, handleClose, cid, qid }) => {
  const [form] = Form.useForm()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const fetchQuestion = async () => {
      if (qid) {
        try {
          const questions = await API.questions.index(qid)
          const myQuestion = questions.yourQuestions?.[0]
          if (myQuestion?.text) {
            form.setFieldsValue({
              abstract: myQuestion.text.substring(0, 100),
              body: myQuestion.text.length > 100 ? myQuestion.text : '',
            })
          }
        } catch (e) {
          message.error('Failed to fetch queue question text.')
        }
      }
    }
    if (isOpen) {
      fetchQuestion()
    }
  }, [isOpen, qid, form])

  const onFinish = async (values: {
    abstract: string
    body: string
    getAIAnswer: boolean
  }) => {
    setIsLoading(true)
    try {
      await API.asyncQuestions.create(
        {
          questionAbstract: values.abstract,
          questionText: values.body,
        },
        cid,
      )

      const questions = await API.questions.index(qid)
      const myQuestion = questions.yourQuestions?.[0]
      if (myQuestion) {
        await API.questions.update(myQuestion.id, {
          status: ClosedQuestionStatus.ConfirmedDeleted,
        })
      }

      message.success('Successfully converted your question!')
      handleClose()
    } catch (e) {
      const errorMessage = getErrorMessage(e)
      message.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal
      open={isOpen}
      onCancel={handleClose}
      title="Convert Queue Question to Anytime Question"
      footer={null}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{ getAIAnswer: true }}
      >
        <Form.Item
          name="abstract"
          label="Question Abstract"
          rules={[{ required: true, message: 'Please input a title.' }]}
        >
          <Input placeholder="A short summary of your question" />
        </Form.Item>
        <Form.Item name="body" label="Question Body (Optional)">
          <Input.TextArea rows={4} placeholder="Add more details here" />
        </Form.Item>
        <Form.Item
          name="getAIAnswer"
          valuePropName="checked"
          help="An AI will attempt to answer your question. A human will be able to see your question and the AI's answer."
        >
          <Checkbox disabled defaultChecked>
            Get an AI answer
          </Checkbox>
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={isLoading} block>
            Post Anytime Question
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default ConvertQueueQToAnytimeQModal
