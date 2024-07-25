import {
  Button,
  Form,
  Input,
  Modal,
  Pagination,
  Progress,
  Table,
  Tooltip,
  message,
} from 'antd'
import React, { ReactElement, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import toast from 'react-hot-toast'
import {
  FileAddOutlined,
  GithubOutlined,
  InboxOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import { RcFile } from 'antd/lib/upload'
import Dragger from 'antd/lib/upload/Dragger'
import ChatbotParameter from './ChatbotParameter'
import { useProfile } from '../../hooks/useProfile'
import axios from 'axios'

export interface ChatbotDocument {
  id: number
  name: string
  type: string
  subDocumentIds: string[]
}

export interface ChatbotDocumentResponse {
  chatQuestions: ChatbotDocument[]
  total: number
}

interface ChatbotPanelProps {
  cid: number
}
export default function ChatbotSettings({
  cid,
}: ChatbotPanelProps): ReactElement {
  const [form] = Form.useForm()
  const profile = useProfile()
  const courseId = useRouter().query.cid
  const [chatbotParameterModalOpen, setChatbotParameterModalOpen] =
    useState(false)
  const [addDocumentModalOpen, setAddDocumentModalOpen] = useState(false)
  const [documentType, setDocumentType] = useState('FILE')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [countProcessed, setCountProcessed] = useState(0)
  const [selectViewEnabled, setSelectViewEnabled] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [totalDocuments, setTotalDocuments] = useState(0)
  const [chatbotDocuments, setChatbotDocuments] = useState([])
  const [filteredDocuments, setFilteredDocuments] = useState([])

  const [fileList, setFileList] = useState([])

  const props = {
    name: 'file',
    multiple: true,
    accept: '.docx,.pptx,.txt,.csv,.pdf',
    fileList,
    onChange(info) {
      setFileList(info.fileList)
    },
    beforeUpload: () => false, // Prevent automatic upload
  }

  const rowSelection = {
    type: 'checkbox',
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys)
    },
  }
  const hasSelected = selectedRowKeys.length > 0

  useEffect(() => {
    getDocuments()
  }, [cid])

  useEffect(() => {
    filterDocuments()
  }, [search, chatbotDocuments])

  const handleDeleteSelectedDocuments = async () => {
    setLoading(true)
    setCountProcessed(0)
    try {
      for (const docId of selectedRowKeys) {
        await fetch(`/chat/${courseId}/${docId}/document`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            HMS_API_TOKEN: profile.chat_token.token,
          },
        })
        setCountProcessed((prev) => prev + 1)
      }
      toast.success('Documents deleted.')
      getDocuments()
    } catch (e) {
      toast.error('Failed to delete documents.')
    } finally {
      setSelectViewEnabled(false)
      setSelectedRowKeys([])
      setLoading(false)
    }
  }

  const columns = [
    {
      title: 'Name',
      dataIndex: 'docName',
      key: 'docName',
    },

    {
      title: 'Source',
      dataIndex: 'sourceLink',
      key: 'sourceLink',
      render: (text, record) => (
        <a href={record.sourceLink} target="_blank" rel="noopener noreferrer">
          Source Link
        </a>
      ),
    },
    {
      title: (
        <>
          <Button
            disabled={loading}
            onClick={() => setSelectViewEnabled(!selectViewEnabled)}
          >
            {!selectViewEnabled ? 'Select' : 'Cancel'}
          </Button>

          {hasSelected && (
            <Button
              disabled={loading}
              onClick={() => handleDeleteSelectedDocuments()}
              danger
            >
              Delete Selected
            </Button>
          )}

          {loading && (
            <Progress
              percent={Math.round(
                (countProcessed / selectedRowKeys.length) * 100,
              )}
            />
          )}
        </>
      ),
      key: 'action',
      render: (text, record) =>
        !selectViewEnabled && (
          <Button
            disabled={loading}
            onClick={() => handleDeleteDocument(record)}
            danger
          >
            Delete
          </Button>
        ),
    },
  ]
  const getDocuments = async () => {
    try {
      const response = await axios.get(`/chat/${courseId}/aggregateDocuments`, {
        headers: {
          HMS_API_TOKEN: profile?.chat_token.token,
        },
      })
      console.log(response)
      const formattedDocuments = response.data.map((doc) => ({
        key: doc.id,
        docId: doc.id,
        docName: doc.pageContent,
        sourceLink: doc.metadata.source,
        pageNumbers: [],
      }))
      setChatbotDocuments(formattedDocuments)
      setTotalDocuments(formattedDocuments.length)
    } catch (e) {
      console.error(e)
      setChatbotDocuments([])
      setTotalDocuments(0)
    } finally {
      setLoading(false)
    }
  }

  const filterDocuments = () => {
    const filtered = chatbotDocuments.filter((doc) =>
      doc.docName.toLowerCase().includes(search.toLowerCase()),
    )
    setFilteredDocuments(filtered)
  }

  const addUrl = async (url: string) => {
    setLoading(true)
    try {
      const data = {
        url: url,
      }

      const response = await fetch(`/chat/${cid}/document/url/github`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          HMS_API_TOKEN: profile.chat_token.token,
        },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        message.success('File uploaded.')
      } else {
        message.warn(
          `Failed to upload file, please check the file type of linked document`,
        )
      }
    } catch (e) {
      console.log(e)
    } finally {
      setLoading(false)
    }
    getDocuments()
  }

  const uploadFiles = async (files: RcFile[], source: string) => {
    setCountProcessed(0)
    for (const file of files) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        // Create a JSON object and convert it to a string
        const jsonData = {
          source: source,
        }
        formData.append(
          'source',
          new Blob([JSON.stringify(jsonData)], { type: 'application/json' }),
        )

        const response = await fetch(`/chat/${cid}/document`, {
          method: 'POST',
          body: formData,
          headers: { HMS_API_TOKEN: profile.chat_token.token },
        })

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`)
        }

        toast.success(`${file.name} uploaded.`)
        setCountProcessed((prev) => prev + 1)
      } catch (e) {
        toast.error(`Failed to upload ${file.name}`)
      }
    }
  }

  const handleDeleteDocument = async (record: any) => {
    setLoading(true)
    try {
      const response = await fetch(`/chat/${cid}/${record.docId}/document`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          HMS_API_TOKEN: profile.chat_token.token,
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to upload ${file.name}`)
      }

      toast.success('Document deleted.')
      getDocuments()
    } catch (e) {
      toast.error('Failed to delete document.')
    } finally {
      setLoading(false)
    }
  }

  const addDocument = async () => {
    setLoading(true)
    try {
      const formData = await form.validateFields()

      if (documentType === 'URL') {
        await addUrl(formData.url)
      }

      if (documentType === 'FILE') {
        const files = fileList.map((file) => file.originFileObj)
        await uploadFiles(files, formData.source)
      }

      setAddDocumentModalOpen(false)
      setLoading(false)
      setFileList([])
      form.resetFields()
      getDocuments()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="m-auto my-5 max-w-[800px]">
      <Modal
        title="Add a new document for your chatbot to use."
        open={addDocumentModalOpen}
        onCancel={() => !loading && setAddDocumentModalOpen(false)}
        footer={[
          <Button
            key="ok"
            type="ghost"
            onClick={() => setAddDocumentModalOpen(false)}
          >
            Cancel
          </Button>,
          <Button
            key="ok"
            type="primary"
            onClick={addDocument}
            disabled={loading}
          >
            Submit
          </Button>,
        ]}
      >
        <>
          <div>
            <p>
              <strong>Accepted File Types:</strong> .docx, .pptx, .txt, .csv,
              .pdf
            </p>
          </div>
          <div className="mb-2 flex h-fit w-full items-center justify-center gap-2">
            <div
              className={`${
                documentType == 'FILE'
                  ? 'border-blue-300 text-black'
                  : 'border-blue-100 text-gray-600'
              } flex flex-grow cursor-pointer items-center justify-center gap-2 rounded-lg  border-2 p-5 hover:bg-blue-50`}
              onClick={() => setDocumentType('FILE')}
            >
              <FileAddOutlined />
              <p className="text-md font-semibold">Upload Files</p>
            </div>
            <div
              className={`${
                documentType == 'URL'
                  ? 'border-blue-300 text-black'
                  : 'border-blue-100 text-gray-600'
              } flex flex-grow cursor-pointer items-center  justify-center gap-2 rounded-lg border-2  p-5 hover:bg-blue-50`}
              onClick={() => setDocumentType('URL')}
            >
              <GithubOutlined />
              <p className="text-md font-semibold">GitHub File</p>
            </div>
          </div>
          <Form form={form}>
            {documentType === 'URL' && (
              <Form.Item
                name="url"
                rules={[
                  {
                    required: true,
                    message: 'Please provide a document URL.',
                  },
                ]}
              >
                <Input placeholder="Enter URL for a pdf file..." />
              </Form.Item>
            )}
            {documentType === 'FILE' && (
              <>
                <Form.Item
                  name="files"
                  rules={[
                    {
                      required: true,
                      message: 'Please provide document files.',
                    },
                  ]}
                >
                  <Dragger {...props}>
                    <p className="ant-upload-drag-icon">
                      <InboxOutlined />
                    </p>
                    <p className="ant-upload-text">
                      Click or drag file to this area to upload
                    </p>
                    <p className="ant-upload-hint">
                      Support for a single or bulk upload. Strictly prohibited
                      from uploading company data or other banned files.
                    </p>
                  </Dragger>
                </Form.Item>
                {loading && (
                  <Progress
                    percent={Math.round(
                      (countProcessed / fileList.length) * 100,
                    )}
                  />
                )}
                <Tooltip
                  title={
                    'This preview URL will be used to redirect your students to view this file. Make sure to include http header unless you want to redirect route on this site.'
                  }
                >
                  <p>
                    Preview URL{' '}
                    <span>
                      <QuestionCircleOutlined style={{ marginLeft: '5px' }} />
                    </span>{' '}
                  </p>
                </Tooltip>
                <Form.Item
                  name="source"
                  rules={[
                    {
                      required: true,
                      message: 'Please provide a document preview URL.',
                    },
                  ]}
                >
                  <Input placeholder="Enter document preview URL..." />
                </Form.Item>
              </>
            )}
          </Form>
        </>
      </Modal>
      <div className="flex w-full items-center justify-between">
        <div className="">
          <h3 className="m-0 p-0 text-4xl font-bold text-gray-900">
            Manage Chatbot Documents
          </h3>
          <p className="text-[16px] font-medium text-gray-600">
            Configure the documents that your chatbot will have access to
          </p>
        </div>
        <Button onClick={() => setChatbotParameterModalOpen(true)}>
          Chatbot Parameters
        </Button>
        <Button onClick={() => setAddDocumentModalOpen(true)}>
          Add Document
        </Button>
      </div>
      <hr className="my-5 w-full"></hr>

      <Input
        placeholder={'Search document name...'}
        // prefix={<SearchOutlined />}
        value={search}
        onChange={(e) => {
          e.preventDefault()
          setSearch(e.target.value)
        }}
        onPressEnter={getDocuments}
      />
      <Table
        columns={columns}
        rowSelection={selectViewEnabled && rowSelection}
        dataSource={filteredDocuments}
        style={{ maxWidth: '800px' }}
        pagination={false}
      />
      <div className="my-1"></div>
      <Pagination
        style={{ float: 'right' }}
        total={totalDocuments}
        pageSizeOptions={[10, 20, 30, 50]}
        showSizeChanger
      />
      {chatbotParameterModalOpen && (
        <ChatbotParameter
          visible={chatbotParameterModalOpen}
          onClose={() => setChatbotParameterModalOpen(false)}
          courseId={Number(cid)}
        />
      )}
    </div>
  )
}
