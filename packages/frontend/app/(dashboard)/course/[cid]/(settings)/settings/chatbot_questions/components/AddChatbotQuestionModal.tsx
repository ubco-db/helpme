import { useState } from 'react'
import { Checkbox, Form, Input, Modal, Select, message } from 'antd'
import { getErrorMessage } from '@/app/utils/generalUtils'
import MarkdownGuideTooltipBody from './MarkdownGuideTooltipBody'
import { SourceDocument } from '@koh/common'
import { API } from '@/app/api'

interface FormValues {
  question: string
  answer: string
  verified: boolean
  suggested: boolean
}

interface AddChatbotQuestionModalProps {
  open: boolean
  courseId: number
  existingDocuments: SourceDocument[]
  onCancel: () => void
  onAddSuccess: () => void
}

const AddChatbotQuestionModal: React.FC<AddChatbotQuestionModalProps> = ({
  open,
  courseId,
  existingDocuments,
  onCancel,
  onAddSuccess,
}) => {
  const [form] = Form.useForm()
  const [selectedDocuments, setSelectedDocuments] = useState<SourceDocument[]>(
    [],
  )
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: FormValues) => {
    setLoading(true)
    selectedDocuments.forEach((doc) => {
      // Convert string to array of numbers, trimming spaces and ignoring empty entries
      if (doc.pageNumbersString) {
        doc.pageNumbers = doc.pageNumbersString
          .split(',')
          .map((page) => page.trim())
          .filter((page) => page !== '')
          .map((page) => parseInt(page, 10))
      }
    })

    await API.chatbot.staffOnly
      .addQuestion(courseId, {
        question: values.question,
        answer: values.answer,
        verified: values.verified,
        suggested: values.suggested,
        sourceDocuments: selectedDocuments,
      })
      .then(() => {
        message.success('Question successfully added')
        onAddSuccess()
      })
      .catch((error) => {
        const errorMessage = getErrorMessage(error)
        message.error('Error adding question:' + errorMessage)
      })
      .finally(() => {
        setLoading(false)
      })
  }

  return (
    <Modal
      open={open}
      title="Create Question & Answer Pair"
      okText="Create"
      cancelText="Cancel"
      okButtonProps={{
        autoFocus: true,
        htmlType: 'submit',
        loading,
      }}
      cancelButtonProps={{
        danger: true,
        disabled: loading,
      }}
      onCancel={onCancel}
      destroyOnHidden
      modalRender={(dom) => (
        <Form
          layout="vertical"
          form={form}
          initialValues={{ verified: true, suggested: false }}
          name="form_in_modal"
          clearOnDestroy
          onFinish={(values) => onFinish(values)}
        >
          {dom}
        </Form>
      )}
    >
      <Form.Item name="question" label="Question" rules={[{ required: true }]}>
        <Input.TextArea autoSize={{ minRows: 1, maxRows: 5 }} />
      </Form.Item>
      <Form.Item
        name="answer"
        label="Answer"
        tooltip={{
          title: <MarkdownGuideTooltipBody />,
          classNames: {
            body: 'min-w-[420px]',
          },
        }}
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
      <span className="text-base font-bold">Source Documents</span>
      <Select
        className="my-4 w-full"
        placeholder="Select a document to add"
        mode="multiple"
        onSelect={(selectedDocId) => {
          const selectedDoc = existingDocuments.find(
            (doc) => doc.docId === selectedDocId,
          )
          if (selectedDoc) {
            setSelectedDocuments((prev) => {
              const isAlreadySelected = prev.some(
                (doc) => doc.docId === selectedDocId,
              )
              if (!isAlreadySelected) {
                return [...prev, { ...selectedDoc, pageNumbers: [] }]
              }
              return prev
            })
          }
        }}
      >
        {existingDocuments.map((doc) => (
          <Select.Option key={doc.docId} value={doc.docId}>
            {doc.docName}
          </Select.Option>
        ))}
      </Select>

      {selectedDocuments.map((doc) => (
        <div key={doc.docId}>
          <span className="font-bold">{doc.docName}</span>
          <Input
            key={doc.docId}
            type="text"
            placeholder="Enter page numbers (comma separated)"
            value={doc.pageNumbersString}
            onChange={(e) => {
              doc.pageNumbersString = e.target.value
            }}
          />
        </div>
      ))}
    </Modal>
  )
}

export default AddChatbotQuestionModal
