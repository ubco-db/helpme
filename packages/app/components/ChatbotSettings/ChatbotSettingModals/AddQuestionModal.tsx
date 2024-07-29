import React, { useState } from 'react'
import { Button, Form, Input, Modal, Select, Switch, message } from 'antd'

interface AddQuestionModalProps {
  visible: boolean
  onClose: () => void
  courseId: number
  existingDocuments: any[]
  getQuestions: () => void
}

export default function AddQuestionModal({
  visible,
  onClose,
  courseId,
  existingDocuments,
  getQuestions,
}: AddQuestionModalProps): React.ReactElement {
  const [form] = Form.useForm()
  const [selectedDocuments, setSelectedDocuments] = useState([])

  const addQuestion = async () => {
    const formData = await form.validateFields()

    try {
      selectedDocuments.forEach((doc) => {
        if (typeof doc.pageNumbers === 'string') {
          // Convert string to array of numbers, trimming spaces and ignoring empty entries
          doc.pageNumbers = doc.pageNumbers
            .split(',')
            .map((page) => page.trim())
            .filter((page) => page !== '')
            .map((page) => parseInt(page, 10))
        }
      })

      await fetch(`/chat/${courseId}/question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: formData.questionText,
          answer: formData.responseText,
          verified: formData.verified,
          suggested: formData.suggested,
          sourceDocuments: selectedDocuments,
        }),
      })

      getQuestions()
      onClose()
      message.success('Question added.')
    } catch (e) {
      message.error('Failed to add question.' + e)
    } finally {
      form.resetFields()
    }
  }

  return (
    <Modal
      title="Create QA pair"
      visible={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" type="ghost" onClick={onClose}>
          Cancel
        </Button>,
        <Button key="submit" type="primary" onClick={addQuestion}>
          Submit
        </Button>,
      ]}
    >
      <Form form={form}>
        <Form.Item
          label="Question"
          name="questionText"
          rules={[
            {
              required: true,
              message: 'Please input a question!',
            },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Answer"
          name="responseText"
          rules={[
            {
              required: true,
              message: 'Please input an answer!',
            },
          ]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Verified"
          name="verified"
          valuePropName="checked"
          initialValue={true}
        >
          <Switch />
        </Form.Item>
        <Form.Item
          label="Suggested"
          name="suggested"
          valuePropName="checked"
          initialValue={false}
        >
          <Switch />
        </Form.Item>
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

        {selectedDocuments.map((doc, index) => (
          <div key={doc.docId}>
            <span className="font-bold">{doc.docName}</span>
            <Input
              type="text"
              placeholder="Enter page numbers (comma separated)"
              value={doc.pageNumbers}
              onChange={(e) => {
                const updatedPageNumbers = e.target.value
                // Split by comma, trim whitespace, filter empty strings, convert to numbers
                const pageNumbersArray = updatedPageNumbers
                  .split(',')
                  .map(Number)
                setSelectedDocuments((prev) =>
                  prev.map((d, idx) =>
                    idx === index
                      ? { ...d, pageNumbers: pageNumbersArray } // array of numbers
                      : d,
                  ),
                )
              }}
            />
          </div>
        ))}
      </Form>
    </Modal>
  )
}
