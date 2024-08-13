import React, { useState, useEffect } from 'react'
import {
  Modal,
  Form,
  Input,
  Button,
  Checkbox,
  Collapse,
  Select,
  message,
} from 'antd'
import { User } from '@koh/common'
const { Panel } = Collapse

interface EditChatbotQuestionModalProps {
  editingRecord: any
  visible: boolean
  setEditingRecord: (record: any) => void
  onSuccessfulUpdate: () => void
  courseId: number
  profile: User
}

type Document = {
  id: number
  pageContent: string
  metadata: {
    source: string
  }
}

type SelectedDocument = {
  docId: number
  docName: string
  sourceLink: string
  pageNumbers: number[]
}

const EditChatbotQuestionModal: React.FC<EditChatbotQuestionModalProps> = ({
  editingRecord,
  visible,
  setEditingRecord,
  onSuccessfulUpdate,
  courseId,
  profile,
}) => {
  const [form] = Form.useForm()

  // stores all related documents in db
  const [existingDocuments, setExistingDocuments] = useState([])
  // stores selected documents for the question
  const [selectedDocuments, setSelectedDocuments] = useState([])

  useEffect(() => {
    fetch(`/chat/${courseId}/aggregateDocuments`, {
      headers: { HMS_API_TOKEN: profile.chat_token.token },
    })
      .then((res) => res.json())
      .then((json) => {
        // Convert the json to the expected format
        const formattedDocuments = json.map((doc: Document) => ({
          docId: doc.id,
          docName: doc.pageContent,
          sourceLink: doc.metadata.source,
          pageNumbers: [],
        }))
        setExistingDocuments(formattedDocuments)
      })
  }, [visible, profile.chat_token.token, courseId])

  useEffect(() => {
    // Reset form with new editing record when visible or editingRecord changes
    if (visible && editingRecord) {
      form.resetFields()
      form.setFieldsValue(editingRecord)
    }
  }, [editingRecord, visible, form])
  const onFormSubmit = async (values: { sourceDocuments: any[] }) => {
    values.sourceDocuments.forEach((doc) => {
      if (typeof doc.pageNumbers === 'string') {
        // Convert string to array of numbers, trimming spaces and ignoring empty entries
        doc.pageNumbers = doc.pageNumbers
          .split(',')
          .map((page: string) => page.trim())
          .filter((page: string) => page !== '')
          .map((page: string) => parseInt(page, 10))
      }
    })

    const sourceDocumentsWithSelected = [
      ...(values.sourceDocuments || []),
      ...selectedDocuments,
    ]

    const valuesWithId = {
      ...values,
      id: editingRecord.id,
      sourceDocuments: sourceDocumentsWithSelected,
    }

    try {
      const response = await fetch(`/chat/${courseId}/question`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          HMS_API_TOKEN: profile.chat_token.token,
        },
        body: JSON.stringify(valuesWithId),
      })
      if (!response.ok) {
        throw new Error('Network response was not ok')
      } else {
        message.success('Question updated successfully')
      }
      onSuccessfulUpdate()
    } catch (error) {
      console.error('Error fetching from API:', error)
      return null
    } finally {
      setEditingRecord(null)
    }
  }

  return (
    <Modal
      title="Edit Question"
      open={visible}
      onCancel={() => {
        setEditingRecord(null)
        form.resetFields()
      }}
      footer={null}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onFormSubmit}
        initialValues={editingRecord}
      >
        <Form.Item
          name="question"
          label="Question"
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="answer" label="Answer" rules={[{ required: true }]}>
          <Input.TextArea rows={8} />
        </Form.Item>
        <Form.Item name="verified" valuePropName="checked">
          <Checkbox>Mark Q&A as Verified by Human</Checkbox>
        </Form.Item>
        <Form.Item name="suggested" valuePropName="checked">
          <Checkbox>Mark Q&A as Suggested </Checkbox>
        </Form.Item>
        <span className="font-bold">Source Documents</span>
        <Form.List name="sourceDocuments">
          {(fields, { add, remove }) => (
            <Collapse>
              {fields.map((field, index) => (
                <Panel
                  header={
                    (
                      form.getFieldValue([
                        'sourceDocuments',
                        field.name,
                        'docName',
                      ]) || `Document ${index + 1}`
                    ).substring(0, 50) +
                    ((
                      form.getFieldValue([
                        'sourceDocuments',
                        field.name,
                        'docName',
                      ]) || ''
                    ).length > 50
                      ? '...'
                      : '')
                  }
                  key={field.key}
                >
                  <div style={{ marginBottom: '10px' }}>
                    <Form.Item
                      name={[field.name, 'docName']}
                      rules={[{ required: true }]}
                      label="Document Name"
                    >
                      <Input placeholder="Document Name" />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'sourceLink']}
                      rules={[{ required: true }]}
                      label="Source Link"
                    >
                      <Input placeholder="Source Link" />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'pageNumbers']}
                      rules={[{ required: true }]}
                      label="Page Numbers (comma separated)"
                    >
                      <Input placeholder="1,2,3" />
                    </Form.Item>
                    <Button
                      onClick={() => remove(field.name)}
                      style={{ marginBottom: '10px' }}
                    >
                      Remove Document
                    </Button>
                  </div>
                </Panel>
              ))}
            </Collapse>
          )}
        </Form.List>

        <Select
          className="my-4"
          placeholder="Select a document to add"
          style={{ width: '100%' }}
          onSelect={(selectedDocId) => {
            const selectedDoc = existingDocuments.find(
              (doc: SelectedDocument) => doc.docId === selectedDocId,
            )
            if (selectedDoc) {
              setSelectedDocuments((prev: any) => {
                const isAlreadySelected = prev.some(
                  (doc: SelectedDocument) => doc.docId === selectedDocId,
                )
                if (!isAlreadySelected) {
                  return [
                    ...prev,
                    { ...(selectedDoc as SelectedDocument), pageNumbers: [] },
                  ]
                }
                return prev
              })
            }
          }}
        >
          {existingDocuments.map((doc: SelectedDocument) => (
            <Select.Option key={doc.docId} value={doc.docId}>
              {doc.docName}
            </Select.Option>
          ))}
        </Select>

        {selectedDocuments.map((doc: SelectedDocument, index) => (
          <div key={doc.docId}>
            <span className="font-bold">{doc.docName}</span>
            <Input
              type="text"
              placeholder="Enter page numbers (comma separated)"
              value={doc.pageNumbers as any}
              onChange={(e) => {
                const updatedPageNumbers = e.target.value
                // Split by comma, trim whitespace, filter empty strings, convert to numbers
                const pageNumbersArray = updatedPageNumbers
                  .split(',')
                  .map(Number)
                setSelectedDocuments((prev: any) =>
                  prev.map((d: any, idx: number) =>
                    idx === index
                      ? { ...d, pageNumbers: pageNumbersArray } // array of numbers
                      : d,
                  ),
                )
              }}
            />
          </div>
        ))}

        <Form.Item>
          <Button type="primary" htmlType="submit">
            Save Changes
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default EditChatbotQuestionModal
