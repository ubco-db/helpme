import React, { useState, useEffect } from 'react'
import { Table, Button, Modal, Input, Form, message } from 'antd'
import { useProfile } from '../../hooks/useProfile'
import axios from 'axios'

interface ChatbotDocumentsProps {
  courseId: number
}

export default function ChatbotDocuments({ courseId }: ChatbotDocumentsProps) {
  const [documents, setDocuments] = useState([])
  const profile = useProfile()
  const [search, setSearch] = useState('')
  const [addModelOpen, setAddModelOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)
  const [editRecordModalVisible, setEditRecordModalVisible] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    axios
      .get(`/chat/${courseId}/allDocumentChunks`, {
        headers: {
          HMS_API_TOKEN: profile.chat_token.token,
        },
      })
      .then((response) => {
        console.log(response.data)
        setDocuments(response.data)
      })
  }, [addModelOpen, courseId])

  const columns = [
    {
      title: 'Name',
      dataIndex: ['metadata', 'name'],
      key: 'name',
      width: 150,
      sorter: (a, b) => a.metadata.name.localeCompare(b.metadata.name),
      render: (text, record) => (
        <a
          href={record.metadata.source}
          target="_blank"
          rel="noopener noreferrer"
        >
          {text}
        </a>
      ),
    },
    {
      title: 'Document Content',
      dataIndex: 'pageContent',
      key: 'pageContent',
      width: 300,
      render: (text) => (
        <div
          style={{
            maxHeight: '150px',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
          }}
        >
          {text}
        </div>
      ),
    },
    {
      title: 'Summary',
      dataIndex: ['metadata', 'summary'],
      key: 'summary',
      width: 300,
      render: (text) => (
        <div
          style={{
            maxHeight: '150px',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
          }}
        >
          {text}
        </div>
      ),
    },
    {
      title: 'Page Number',
      dataIndex: ['metadata', 'loc', 'pageNumber'],
      key: 'pageNumber',
      width: 100,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <div>
          <Button
            style={{ marginBottom: '8px' }}
            onClick={() => showModal(record)}
          >
            Edit
          </Button>
          <Button
            danger
            onClick={() => {
              Modal.confirm({
                title: 'Are you sure you want to delete this document?',
                content: 'This action cannot be undone.',
                okText: 'Yes',
                okType: 'danger',
                cancelText: 'No',
                onOk() {
                  deleteDocument(record.id)
                },
              })
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ]

  const showModal = (record) => {
    setEditingRecord(record)
    setEditRecordModalVisible(true)
  }

  const deleteDocument = async (documentId) => {
    try {
      await fetch(`/chat/${courseId}/document/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      fetchDocuments()
      message.success('Document deleted successfully.')
    } catch (e) {
      message.error('Failed to delete document.')
    }
  }

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`/chat/${courseId}/allDocumentChunks`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          HMS_API_TOKEN: profile.chat_token.token,
        },
      })

      if (!response.ok) {
        throw new Error('Network response was not ok')
      }
      const data = await response.json()
      setDocuments(data.documents)
    } catch (e) {
      console.error('Failed to fetch documents:', e)
      message.error('Failed to load documents.')
    }
  }

  return (
    <div className="m-auto my-5 max-w-[1000px]">
      <Modal
        title="Create a new document entry!"
        open={addModelOpen}
        onCancel={() => setAddModelOpen(false)}
        footer={[
          <Button
            key="cancel"
            type="ghost"
            onClick={() => setAddModelOpen(false)}
          >
            Cancel
          </Button>,
          <Button key="submit" type="primary" onClick={() => form.submit()}>
            Submit
          </Button>,
        ]}
      >
        <Form form={form} onFinish={addDocument}>
          <Form.Item
            label="Document Name"
            name="documentName"
            rules={[
              { required: true, message: 'Please input a document name!' },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Content"
            name="content"
            rules={[
              { required: true, message: 'Please input the document content!' },
            ]}
          >
            <Input.TextArea />
          </Form.Item>
          <Form.Item label="Summary" name="summary">
            <Input.TextArea />
          </Form.Item>
          <Form.Item label="Source" name="source">
            <Input />
          </Form.Item>
          <Form.Item label="Page Number" name="pageNumber">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
      <div className="flex w-full items-center justify-between">
        <div className="">
          <h3 className="m-0 p-0 text-4xl font-bold text-gray-900">
            View Chatbot Documents
          </h3>
          <p className="text-[16px] font-medium text-gray-600">
            View and manage the documents available to your chatbot
          </p>
        </div>
        <Button onClick={() => setAddModelOpen(true)}>Add Document</Button>
      </div>
      <hr className="my-5 w-full"></hr>
      <Input
        placeholder={'Search document...'}
        value={search}
        onChange={(e) => {
          e.preventDefault()
          setSearch(e.target.value)
        }}
        onPressEnter={fetchDocuments}
      />
      <Table
        columns={columns}
        dataSource={documents}
        pagination={{ pageSize: 7 }}
        scroll={{ x: '100%' }}
      />
      {editingRecord && (
        <EditDocumentModal
          editingRecord={editingRecord}
          visible={editRecordModalVisible}
          setEditingRecord={setEditRecordModalVisible}
          onSuccessfulUpdate={fetchDocuments}
        />
      )}
    </div>
  )
}
/* eslint-disable react/prop-types */
const EditDocumentModal = ({
  editingRecord,
  visible,
  setEditingRecord,
  onSuccessfulUpdate,
}) => {
  const [form] = Form.useForm()

  useEffect(() => {
    if (editingRecord) {
      form.setFieldsValue({
        documentName: editingRecord.metadata.name,
        content: editingRecord.pageContent,
        summary: editingRecord.metadata.summary,
        source: editingRecord.metadata.source,
        pageNumber: editingRecord.metadata.loc.pageNumber,
      })
    }
  }, [editingRecord, form])

  const handleOk = async () => {
    try {
      const values = await form.validateFields()
      await fetch(`/chat/document/${editingRecord.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...values,
        }),
      })
      onSuccessfulUpdate()
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
        <Form.Item
          label="Content"
          name="content"
          rules={[
            { required: true, message: 'Please input the document content!' },
          ]}
        >
          <Input.TextArea />
        </Form.Item>
        <Form.Item label="Summary" name="summary">
          <Input.TextArea />
        </Form.Item>
        <Form.Item label="Source" name="source">
          <Input />
        </Form.Item>
        <Form.Item label="Page Number" name="pageNumber">
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  )
}

const addDocument = async (values) => {
  // Add documents
}
