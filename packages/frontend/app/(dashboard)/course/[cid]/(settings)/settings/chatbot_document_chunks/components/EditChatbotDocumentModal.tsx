'use client'

import { useEffect } from 'react'
import { Modal, Input, Form, message } from 'antd'

export default function EditDocumentModal({
  editingRecord,
  visible,
  courseId,
  setEditingRecord,
  onSuccessfulUpdate,
  chatbotToken,
}) {
  const [form] = Form.useForm()

  useEffect(() => {
    if (editingRecord) {
      form.setFieldsValue({
        documentName: editingRecord.metadata.name,
        content: editingRecord.pageContent,
        source: editingRecord.metadata.source,
      })
    }
  }, [editingRecord, form])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      const response = await fetch(
        `/chat/${courseId}/${editingRecord.id}/documentChunk`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            HMS_API_TOKEN: chatbotToken,
          },
          body: JSON.stringify({
            documentText: values.content,
            metadata: {
              name: values.documentName,
              source: values.source,
            },
          }),
        },
      )

      if (!response.ok) {
        throw new Error('Network response was not ok')
      }

      const updatedDoc = await response.json()
      onSuccessfulUpdate(updatedDoc)
      setEditingRecord(false)
      message.success('Document updated successfully.')
    } catch (e) {
      message.error('Failed to update document.')
    }
  }

  return (
    <Modal
      title="Edit Document"
      visible={visible}
      onCancel={() => setEditingRecord(false)}
      onOk={handleOk}
      width={800}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="Document Name"
          name="documentName"
          rules={[
            { required: true, message: 'Please input the document name!' },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item label="Content" name="content">
          <Input.TextArea style={{ height: 120 }} />
        </Form.Item>
        <Form.Item label="Source" name="source">
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  )
}
