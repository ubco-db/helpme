'use client'

import { useState, useEffect, ReactElement, useCallback, use } from 'react'
import { Table, Button, Modal, Input, Form, message, InputNumber } from 'antd'
import Link from 'next/link'
import { getErrorMessage } from '@/app/utils/generalUtils'
import Highlighter from 'react-highlight-words'
import ExpandableText from '@/app/components/ExpandableText'
import EditDocumentChunkModal from './components/EditChatbotDocumentChunkModal'
import { AddDocumentChunkParams, SourceDocument } from '@koh/common'
import { API } from '@/app/api'
import ChunkHelpTooltip from './components/ChunkHelpTooltip'

interface FormValues {
  content: string
  source: string
  pageNumber: string
}

interface ChatbotDocumentsProps {
  params: Promise<{ cid: string }>
}

export default function ChatbotDocuments(
  props: ChatbotDocumentsProps,
): ReactElement {
  const params = use(props.params)
  const courseId = Number(params.cid)
  const [documents, setDocuments] = useState<SourceDocument[]>([])
  const [filteredDocuments, setFilteredDocuments] = useState<SourceDocument[]>(
    [],
  )
  const [search, setSearch] = useState('')
  const [editingRecord, setEditingRecord] = useState<SourceDocument | null>(
    null,
  )
  const [editRecordModalOpen, setEditRecordModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [addDocChunkPopupVisible, setAddDocChunkPopupVisible] = useState(false)

  const addDocument = async (values: FormValues) => {
    const body: AddDocumentChunkParams = {
      documentText: values.content,
      metadata: {
        name: 'Manually Inserted Information',
        type: 'inserted_document',
        source: values.source ?? undefined,
        loc: values.pageNumber
          ? { pageNumber: parseInt(values.pageNumber) }
          : undefined,
      },
    }
    await API.chatbot.staffOnly
      .addDocumentChunk(courseId, body)
      .then(() => {
        message.success('Document added successfully.')
        fetchDocuments()
      })
      .catch((e) => {
        const errorMessage = getErrorMessage(e)
        message.error('Failed to add document: ' + errorMessage)
      })
  }

  const fetchDocuments = useCallback(async () => {
    await API.chatbot.staffOnly
      .getAllDocumentChunks(courseId)
      .then((response) => {
        response = response.map((doc) => ({
          ...doc,
          key: doc.id,
        }))
        setDocuments(response)
        setFilteredDocuments(response)
      })
      .catch((e) => {
        const errorMessage = getErrorMessage(e)
        message.error('Failed to load documents: ' + errorMessage)
      })
  }, [courseId, setDocuments, setFilteredDocuments])

  useEffect(() => {
    if (courseId) {
      fetchDocuments()
    }
  }, [courseId, fetchDocuments])

  const columns = [
    {
      title: 'Name',
      dataIndex: ['metadata', 'name'],
      key: 'name',
      width: 300,
      sorter: (a: SourceDocument, b: SourceDocument) => {
        if (a.metadata?.name && b.metadata?.name) {
          return a.metadata.name.localeCompare(b.metadata.name)
        } else {
          return 0
        }
      },
      render: (text: string, record: SourceDocument) => (
        <ExpandableText maxRows={4}>
          <Link
            href={record.metadata?.source ?? ''}
            target="_blank"
            prefetch={false}
            rel="noopener noreferrer"
          >
            {text}
          </Link>
        </ExpandableText>
      ),
    },
    {
      title: 'Document Content',
      dataIndex: ['pageContent'],
      key: 'pageContent',
      render: (text: string) => (
        <ExpandableText maxRows={4}>
          <Highlighter
            highlightStyle={{ backgroundColor: '#ffc069', padding: 0 }}
            searchWords={[search]}
            autoEscape
            textToHighlight={text ? text.toString() : ''}
          />
        </ExpandableText>
      ),
    },
    {
      title: 'Page #',
      dataIndex: ['metadata', 'loc', 'pageNumber'],
      key: 'pageNumber',
      width: 40,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: any, record: SourceDocument) => (
        <div>
          <Button className="m-2" onClick={() => showModal(record)}>
            Edit
          </Button>
          <Button
            className="m-2"
            danger
            onClick={() => {
              Modal.confirm({
                title: 'Are you sure you want to delete this document chunk?',
                content:
                  'Note that this will not modify the original document nor any chatbot questions that reference this chunk. \n\nThis action cannot be undone.',
                okText: 'Yes',
                okType: 'danger',
                cancelText: 'No',
                onOk() {
                  if (!record.id) {
                    return
                  }
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

  const showModal = (record: SourceDocument) => {
    setEditingRecord(record)
    setEditRecordModalOpen(true)
  }

  const deleteDocument = async (documentId: string) => {
    await API.chatbot.staffOnly
      .deleteDocumentChunk(courseId, documentId)
      .then(() => {
        fetchDocuments()
        message.success('Document deleted successfully.')
      })
      .catch((e) => {
        const errorMessage = getErrorMessage(e)
        message.error('Failed to delete document: ' + errorMessage)
      })
  }

  const handleSearch = (e: any) => {
    setSearch(e.target.value)
    const searchTerm = e.target.value.toLowerCase()
    const filtered = documents.filter((doc) => {
      const isNameMatch = doc.pageContent
        ? doc.pageContent.toLowerCase().includes(searchTerm)
        : false
      return isNameMatch
    })

    setFilteredDocuments(filtered)
  }

  const updateDocumentInState = (updatedDoc: SourceDocument) => {
    const updatedDocuments = documents.map((doc) =>
      doc.id === updatedDoc.id ? updatedDoc : doc,
    )
    setDocuments(updatedDocuments)

    const searchTerm = search.toLowerCase()
    const filtered = updatedDocuments.filter((doc) => {
      const isNameMatch = doc.pageContent
        ? doc.pageContent.toLowerCase().includes(searchTerm)
        : false
      return isNameMatch
    })

    setFilteredDocuments(filtered)
  }

  return (
    <div className="my-5 ml-0 mr-auto max-w-[1000px]">
      <div className="flex w-full items-center justify-between">
        <div>
          <h3 className="m-0 p-0 text-4xl font-bold text-gray-900">
            View Chatbot Document Chunks
          </h3>
          <p className="text-[16px] font-medium text-gray-600">
            View and manage the document chunks from your documents
          </p>
        </div>
        <div className="flex flex-col items-end gap-y-2">
          <Button
            type={addDocChunkPopupVisible ? 'default' : 'primary'}
            onClick={() => setAddDocChunkPopupVisible(!addDocChunkPopupVisible)}
          >
            {addDocChunkPopupVisible
              ? 'Close Add Document Chunk'
              : 'Add Document Chunk'}
          </Button>
          <ChunkHelpTooltip />
        </div>
      </div>
      {addDocChunkPopupVisible && (
        <div className="h-70 top-50 fixed right-1 z-50 w-[360px] bg-white p-4 shadow-lg">
          <Form form={form} onFinish={addDocument}>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">New Document Chunk</h2>
              <ChunkHelpTooltip />
            </div>
            <div className="mt-4">
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
              {/* <Form.Item label="Edited Chunk" name="editedChunk">
              <Input.TextArea />
            </Form.Item> */}
              <Form.Item
                label="Source"
                name="source"
                rules={[
                  {
                    type: 'url',
                    message: 'Please enter a valid URL',
                  },
                ]}
                tooltip="When a student clicks on the citation, they will be redirected to this link"
              >
                <Input />
              </Form.Item>
              <Form.Item
                label="Page Number"
                name="pageNumber"
                rules={[
                  {
                    type: 'number',
                    message: 'Please enter a valid page number',
                    min: 0,
                  },
                ]}
              >
                <InputNumber />
              </Form.Item>
              <div className="mt-4 flex justify-end">
                <Button
                  className="m-2"
                  key="cancel"
                  onClick={() => {
                    form.resetFields() // clear form
                    setAddDocChunkPopupVisible(false)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="m-2"
                  key="submit"
                  type="primary"
                  htmlType="submit"
                >
                  Submit
                </Button>
              </div>
            </div>
          </Form>
        </div>
      )}
      <hr className="my-5 w-full"></hr>
      <Input
        placeholder={'Search document content...'}
        value={search}
        onChange={handleSearch}
        onPressEnter={fetchDocuments}
      />
      <div className="flex justify-between">
        <Table columns={columns} dataSource={filteredDocuments} size="small" />
      </div>
      {editingRecord && (
        <EditDocumentChunkModal
          open={editRecordModalOpen}
          editingRecord={editingRecord}
          courseId={courseId}
          onCancel={() => {
            setEditingRecord(null)
            setEditRecordModalOpen(false)
          }}
          onSuccessfulUpdate={(updatedDoc) => {
            updateDocumentInState(updatedDoc)
            setEditingRecord(null)
            setEditRecordModalOpen(false)
          }}
        />
      )}
    </div>
  )
}
