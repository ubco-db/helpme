import React, { useState, useEffect } from 'react'
import { Table, Radio, Button, Modal, Input, Form, message } from 'antd'
import { useProfile } from '../../hooks/useProfile'
import { CloseOutlined } from '@ant-design/icons'
import axios from 'axios'

interface ChatbotDocumentsProps {
  courseId: number
}

export default function ChatbotDocuments({ courseId }: ChatbotDocumentsProps) {
  const [documents, setDocuments] = useState([])
  const [filteredDocuments, setFilteredDocuments] = useState([])
  const profile = useProfile()
  const [search, setSearch] = useState('')
  const [addModelOpen, setAddModelOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)
  const [editRecordModalVisible, setEditRecordModalVisible] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchDocuments()
  }, [addModelOpen, courseId])

  const fetchDocuments = async () => {
    try {
      const response = await axios.get(`/chat/${courseId}/allDocumentChunks`, {
        headers: {
          HMS_API_TOKEN: profile.chat_token.token,
        },
      })
      setDocuments(response.data)
      setFilteredDocuments(response.data)
    } catch (e) {
      message.error('Failed to load documents.')
    }
  }

  const columns = [
    {
      title: 'Name',
      dataIndex: ['metadata', 'name'],
      key: 'name',
      width: 80,
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
      dataIndex: ['metadata', 'original'],
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
      title: 'Edited Chunk',
      dataIndex: ['pageContent'],
      key: 'editedChunk',
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
      width: 80,
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
      await fetch(`/chat/${courseId}/documentChunk/${documentId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          HMS_API_TOKEN: profile.chat_token.token,
        },
      })
      fetchDocuments()
      message.success('Document deleted successfully.')
    } catch (e) {
      message.error('Failed to delete document.')
    }
  }

  const handleSearch = (e) => {
    setSearch(e.target.value)
    const searchTerm = e.target.value.toLowerCase()

    const filtered = documents.filter((doc) => {
      const isNameMatch = doc.metadata.name.toLowerCase().includes(searchTerm)
      const isUnsuccessful = doc.metadata.editedChunkText
        .toLowerCase()
        .includes('unsuccessful')
      return isNameMatch || isUnsuccessful
    })

    setFilteredDocuments(filtered)
  }

  const updateDocumentInState = (updatedDoc) => {
    const updatedDocuments = documents.map((doc) =>
      doc.id === updatedDoc.id ? updatedDoc : doc,
    )
    setDocuments(updatedDocuments)

    const searchTerm = search.toLowerCase()
    const filtered = updatedDocuments.filter((doc) => {
      const isNameMatch = doc.metadata.name.toLowerCase().includes(searchTerm)
      const isUnsuccessful = doc.metadata.editedChunkText
        .toLowerCase()
        .includes('unsuccessful')
      return isNameMatch || isUnsuccessful
    })

    setFilteredDocuments(filtered)
  }

  return (
    <div className="max-w-[1000px]">
      <div className="justify-left flex w-full items-center">
        <div>
          <h3 className="m-0 p-0 text-4xl font-bold text-gray-900">
            View Chatbot Documents
          </h3>
          <p className="text-[16px] font-medium text-gray-600">
            View and manage the documents available to your chatbot
          </p>
        </div>
      </div>
      <div className="h-70 top-50 fixed right-0 z-50 w-[360px] bg-white p-4 shadow-lg">
        <Form form={form} onFinish={addDocument}>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">New Document Chunk</h2>
            <Button
              type="text"
              icon={<CloseOutlined />}
              onClick={() => setAddModelOpen(false)}
            />
          </div>
          <div className="mt-4">
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
                {
                  required: true,
                  message: 'Please input the document content!',
                },
              ]}
            >
              <Input.TextArea />
            </Form.Item>
            <Form.Item label="Edited Chunk" name="editedChunk">
              <Input.TextArea />
            </Form.Item>
            <Form.Item label="Source" name="source">
              <Input />
            </Form.Item>
            <Form.Item label="Page Number" name="pageNumber">
              <Input />
            </Form.Item>
            <div className="mt-4 flex justify-end">
              <Button
                key="cancel"
                type="ghost"
                onClick={() => setAddModelOpen(false)}
              >
                Cancel
              </Button>
              <Button key="submit" type="primary" htmlType="submit">
                Submit
              </Button>
            </div>
          </div>
        </Form>
      </div>
      <hr className="my-5 w-full"></hr>
      <Input
        placeholder={'Search document...'}
        value={search}
        onChange={handleSearch}
        onPressEnter={fetchDocuments}
      />
      <div className="flex justify-start">
        <Table
          columns={columns}
          dataSource={filteredDocuments}
          pagination={{ pageSize: 7 }}
          scroll={{ x: '100%' }}
        />
      </div>
      {editingRecord && (
        <EditDocumentModal
          editingRecord={editingRecord}
          visible={editRecordModalVisible}
          setEditingRecord={setEditRecordModalVisible}
          onSuccessfulUpdate={updateDocumentInState}
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
  const [selectedText, setSelectedText] = useState('content')

  useEffect(() => {
    if (editingRecord) {
      form.setFieldsValue({
        documentName: editingRecord.metadata.name,
        content: editingRecord.metadata.original,
        editedChunk: editingRecord.pageContent,
        source: editingRecord.metadata.source,
        pageNumber: editingRecord.metadata.loc.pageNumber,
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
            HMS_API_TOKEN: 'test_token',
          },
          body: JSON.stringify({
            documentText:
              selectedText === 'content' ? values.content : values.editedChunk,
            metadata: {
              name: values.documentName,
              editedChunkText: values.editedChunk,
              source: values.source,
              loc: {
                pageNumber: values.pageNumber,
              },
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

  const handleTextChange = (e) => {
    setSelectedText(e.target.value)
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
        <Form.Item label="Original Content" name="content">
          <Input.TextArea style={{ height: 120 }} />
        </Form.Item>
        <Form.Item label="Edited chunk" name="editedChunk">
          <Input.TextArea style={{ height: 120 }} />
        </Form.Item>
        <Form.Item label="Select Text to Embed">
          <Radio.Group onChange={handleTextChange} value={selectedText}>
            <Radio value="content">Original Content</Radio>
            <Radio value="editedChunk">Edited Chunk</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item label="Source" name="source">
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  )
}

const addDocument = async (values) => {
  // Add documents
}
