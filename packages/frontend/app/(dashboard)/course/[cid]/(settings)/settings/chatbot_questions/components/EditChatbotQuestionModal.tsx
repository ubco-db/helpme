import { useState, useEffect } from 'react'
import { Modal, Form, Input, Button, Checkbox, message, Tooltip } from 'antd'
import axios from 'axios'
import { User } from '@koh/common'
import { ChatbotQuestion, SourceDocument } from '../page'
import { getErrorMessage } from '@/app/utils/generalUtils'

interface FormValues {
  question: string
  answer: string
  verified: boolean
  suggested: boolean
  sourceDocuments: SourceDocument[]
  selectedDocuments: {
    docId: string
    pageNumbersString: string
  }[]
}

interface EditChatbotQuestionModalProps {
  open: boolean
  editingRecord: ChatbotQuestion
  onCancel: () => void
  onSuccessfulUpdate: () => void
  cid: number
  profile: User
}

const EditChatbotQuestionModal: React.FC<EditChatbotQuestionModalProps> = ({
  open,
  editingRecord,
  onCancel,
  onSuccessfulUpdate,
  cid,
  profile,
}) => {
  const [form] = Form.useForm()
  const chatbotToken = profile.chat_token.token

  const [successfulQAInsert, setSuccessfulQAInsert] = useState(false)
  // reset successfulQAInsert when the modal is closed
  useEffect(() => {
    if (!open) {
      setSuccessfulQAInsert(false)
    }
  }, [open])

  const handleOkInsert = async () => {
    const values = await form.validateFields()
    await axios
      .post(
        `/chat/${cid}/documentChunk`,
        {
          documentText: values.question + '\n' + values.answer,
          metadata: {
            name: 'inserted Q&A',
            type: 'inserted_question',
            id: editingRecord.id,
            courseId: cid,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            HMS_API_TOKEN: chatbotToken,
          },
        },
      )
      .then(async (res) => {
        if (res.status !== 200 && res.status !== 201) {
          const errorMessage = getErrorMessage(res)
          message.error('Insert unsuccessful:' + errorMessage)
        } else {
          await axios
            .patch(
              `/chat/${cid}/question`,
              {
                id: editingRecord.id,
                inserted: true,
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  HMS_API_TOKEN: chatbotToken,
                },
              },
            )
            .then((res) => {
              if (res.status !== 200 && res.status !== 201) {
                const errorMessage = getErrorMessage(res)
                message.error('Insert unsuccessful:' + errorMessage)
              } else {
                message.success(
                  'Document inserted successfully. You can now cancel or save the changes you made to the Q&A',
                  6,
                )
                setSuccessfulQAInsert(true)
              }
            })
            .catch((e) => {
              throw e
            })
        }
      })
      .catch((e) => {
        const errorMessage = getErrorMessage(e)
        message.error('Failed to insert document:' + errorMessage)
      })
  }
  const confirmInsert = () => {
    Modal.confirm({
      title:
        'Are you sure you want to insert this Question and Answer into the DocumentStore?',
      content:
        'This will treat this question and answer as a source that the AI can then reference and cite in future questions. \nOnce inserted, this action cannot be undone.',
      onOk: handleOkInsert,
    })
  }

  const onFinish = async (values: FormValues) => {
    values.sourceDocuments.forEach((doc) => {
      // Convert string to array of numbers, trimming spaces and ignoring empty entries
      if (doc.pageNumbersString) {
        doc.pageNumbers = doc.pageNumbersString
          .split(',')
          .map((page) => page.trim())
          .filter((page) => page !== '')
          .map((page) => parseInt(page, 10))
      }
    })
    const valuesWithId = {
      ...values,
      id: editingRecord.id,
    }
    try {
      const response = await fetch(`/chat/${cid}/question`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          HMS_API_TOKEN: chatbotToken,
        },
        body: JSON.stringify(valuesWithId),
      })
      if (!response.ok) {
        const errorMessage = getErrorMessage(response)
        message.error('Save unsuccessful:' + errorMessage)
      } else {
        message.success('Question updated successfully')
        onSuccessfulUpdate()
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      message.error('Error saving question:' + errorMessage)
    }
  }

  return (
    <Modal
      open={open}
      title="Edit Chatbot Question"
      okText="Save Changes"
      cancelText="Cancel"
      okButtonProps={{
        autoFocus: true,
        htmlType: 'submit',
      }}
      cancelButtonProps={{
        danger: true,
      }}
      onCancel={onCancel}
      footer={(_, { OkBtn, CancelBtn }) => (
        <div className={`flex justify-end gap-2`}>
          <CancelBtn />
          <Tooltip
            title={
              editingRecord.inserted || successfulQAInsert
                ? 'This question and answer has already been inserted as a new source document'
                : "This will treat this question and answer as a source that the AI can then reference and cite in future questions (a new document chunk). The question's source documents are ignored"
            }
          >
            <Button
              type="default"
              onClick={confirmInsert}
              disabled={editingRecord.inserted || successfulQAInsert}
            >
              Insert Q&A into DocumentStore
            </Button>
          </Tooltip>
          <OkBtn />
        </div>
      )}
      destroyOnClose
      modalRender={(dom) => (
        <Form
          layout="vertical"
          form={form}
          name="form_in_modal"
          initialValues={{
            answer: editingRecord.answer,
            question: editingRecord.question,
            verified: editingRecord.verified,
            suggested: editingRecord.suggested,
            sourceDocuments: editingRecord.sourceDocuments,
          }}
          clearOnDestroy
          onFinish={(values) => onFinish(values)}
        >
          {dom}
        </Form>
      )}
    >
      <Form.Item
        name="question"
        label="Question"
        rules={[{ required: true, message: 'Please input the question text' }]}
      >
        <Input.TextArea autoSize={{ minRows: 1, maxRows: 5 }} />
      </Form.Item>
      <Form.Item
        name="answer"
        label="Answer"
        rules={[{ required: true, message: 'Please input the answer text' }]}
      >
        <Input.TextArea autoSize={{ minRows: 1, maxRows: 8 }} />
      </Form.Item>
      <Form.Item
        label="Mark Q&A as Verified by Human"
        layout="horizontal"
        name="verified"
        valuePropName="checked"
      >
        <Checkbox />
      </Form.Item>
      <Form.Item
        label="Mark Q&A as Suggested"
        layout="horizontal"
        name="suggested"
        valuePropName="checked"
      >
        <Checkbox />
      </Form.Item>
    </Modal>
  )
}

export default EditChatbotQuestionModal
