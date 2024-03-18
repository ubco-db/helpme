import React, { useState, useEffect } from 'react'
import { Modal, Form, Input, Button, Checkbox, Collapse, Select } from 'antd'
import router from 'next/router'
const { Panel } = Collapse
interface EditChatbotQuestionModalProps {
  editingRecord: any
  visible: boolean
  setEditingRecord: (record: any) => void
  onSuccessfulUpdate: () => void
}

const EditChatbotQuestionModal: React.FC<EditChatbotQuestionModalProps> = ({
  editingRecord,
  visible,
  setEditingRecord,
  onSuccessfulUpdate,
}) => {
  const [form] = Form.useForm()
  const { cid } = router.query
  const [existingDocuments, setExistingDocuments] = useState([])
  const [selectedDocuments, setSelectedDocuments] = useState([])

  useEffect(() => {
    fetch(`/chat/${cid}/aggregateDocuments`)
      .then((res) => res.json())
      .then((json) => {
        // Convert the json to the expected format
        const formattedDocuments = json.map((doc) => ({
          docId: doc.id,
          docName: doc.pageContent,
          sourceLink: doc.metadata.source,
          pageNumbers: [],
        }))
        setExistingDocuments(formattedDocuments)
      })
  }, [cid, visible])

  useEffect(() => {
    // Reset form with new editing record when visible or editingRecord changes
    if (visible && editingRecord) {
      form.resetFields()
      form.setFieldsValue(editingRecord)
    }
  }, [editingRecord, visible, form])
  const onFormSubmit = async (values) => {
    const formattedSelectedDocuments = selectedDocuments.map((doc) => ({
      docName: doc.docName,
      sourceLink: doc.sourceLink,
      pageNumbers: doc.pageNumbers.split(',').map(Number),
    }))
    const sourceDocumentsWithSelected = [
      ...(values.sourceDocuments || []),
      ...formattedSelectedDocuments,
    ]

    const valuesWithId = {
      ...values,
      id: editingRecord.id,
      sourceDocuments: sourceDocumentsWithSelected,
    }
    try {
      const response = await fetch(`/chat/question`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(valuesWithId),
      })
      const json = await response.json()
      onSuccessfulUpdate()
      return json
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
              (doc) => doc.docId === selectedDocId,
            )
            if (selectedDoc) {
              setSelectedDocuments((prev) => {
                const isAlreadySelected = prev.some(
                  (doc) => doc.docId === selectedDocId,
                )
                if (!isAlreadySelected) {
                  return [...prev, { ...selectedDoc, pageNumbers: '' }]
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

        {selectedDocuments.map((doc, index) => (
          <div key={doc.docId}>
            <span className="font-bold">{doc.docName}</span>
            <Input
              type="text"
              placeholder="Enter page numbers (comma separated)"
              value={doc.pageNumbers}
              onChange={(e) => {
                const updatedPageNumbers = e.target.value
                setSelectedDocuments((prev) =>
                  prev.map((d, idx) =>
                    idx === index
                      ? { ...d, pageNumbers: updatedPageNumbers }
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
