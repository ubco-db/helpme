'use client'

import {
  Button,
  Form,
  Input,
  Modal,
  Pagination,
  Progress,
  Switch,
  Table,
  Tooltip,
  message,
} from 'antd'
import { ReactElement, useCallback, useEffect, useState } from 'react'
import {
  FileAddOutlined,
  GithubOutlined,
  InboxOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons'
import { RcFile } from 'antd/lib/upload'
import Dragger from 'antd/lib/upload/Dragger'
import axios from 'axios'
import { useUserInfo } from '@/app/contexts/userContext'
import { SourceDocument } from '../chatbot_questions/page'
import Link from 'next/link'
import { TableRowSelection } from 'antd/es/table/interface'
import ChatbotSettingsModal from './components/ChatbotSettingsModal'
import Highlighter from 'react-highlight-words'

export interface ChatbotDocument {
  id: number
  name: string
  type: string
  subDocumentIds: string[]
}

export interface ChatbotDocumentResponse {
  chatQuestions: SourceDocument[]
  total: number
}

interface ChatbotPanelProps {
  params: { cid: string }
}
export default function ChatbotSettings({
  params,
}: ChatbotPanelProps): ReactElement {
  const courseId = Number(params.cid)
  const [form] = Form.useForm()
  const { userInfo } = useUserInfo()
  const [chatbotParameterModalOpen, setChatbotParameterModalOpen] =
    useState(false)
  const [addDocumentModalOpen, setAddDocumentModalOpen] = useState(false)
  const [isSlideDeck, setIsSlideDeck] = useState(false)
  const [documentType, setDocumentType] = useState('FILE')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [countProcessed, setCountProcessed] = useState(0)
  const [selectViewEnabled, setSelectViewEnabled] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [totalDocuments, setTotalDocuments] = useState(0)
  const [chatbotDocuments, setChatbotDocuments] = useState<SourceDocument[]>([])
  const [filteredDocuments, setFilteredDocuments] = useState<SourceDocument[]>(
    [],
  )

  const [fileList, setFileList] = useState<any[]>([])

  const props = {
    name: 'file',
    multiple: true,
    accept: '.docx,.pptx,.txt,.csv,.pdf',
    fileList,
    onChange(info: any) {
      setFileList(info.fileList)
    },
    beforeUpload: () => false, // Prevent automatic upload
  }

  const rowSelection: TableRowSelection<SourceDocument> = {
    type: 'checkbox',
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys)
    },
  }
  const hasSelected = selectedRowKeys.length > 0

  const handleDeleteSelectedDocuments = async () => {
    setLoading(true)
    setCountProcessed(0)
    try {
      for (const docId of selectedRowKeys) {
        await fetch(`/chat/${courseId}/${docId}/document`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            HMS_API_TOKEN: userInfo.chat_token.token,
          },
        })
        setCountProcessed((prev) => prev + 1)
      }
      message.success('Documents deleted.')
      getDocuments()
    } catch (e) {
      message.error('Failed to delete documents.')
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
      render: (text: string) => (
        <Highlighter
          highlightStyle={{ backgroundColor: '#ffc069', padding: 0 }}
          searchWords={[search]}
          autoEscape
          textToHighlight={text ? text.toString() : ''}
        />
      ),
    },
    {
      title: 'Source',
      dataIndex: 'sourceLink',
      key: 'sourceLink',
      render: (text: string) => (
        <Link href={text} target="_blank" rel="noopener noreferrer">
          Source Link
        </Link>
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

          {hasSelected && selectViewEnabled && (
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
      render: (_: any, record: SourceDocument) =>
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

  const getDocuments = useCallback(async () => {
    try {
      const response = await axios.get(`/chat/${courseId}/aggregateDocuments`, {
        headers: {
          HMS_API_TOKEN: userInfo.chat_token.token,
        },
      })
      const formattedDocuments = response.data.map((doc: SourceDocument) => ({
        key: doc.id,
        docId: doc.id,
        docName: doc.pageContent,
        sourceLink: doc.metadata?.source ?? '',
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
  }, [
    courseId,
    userInfo.chat_token.token,
    setChatbotDocuments,
    setTotalDocuments,
    setLoading,
  ])

  useEffect(() => {
    getDocuments()
  }, [getDocuments])

  useEffect(() => {
    const filtered = chatbotDocuments.filter((doc) =>
      doc.docName.toLowerCase().includes(search.toLowerCase()),
    )
    setFilteredDocuments(filtered)
  }, [search, chatbotDocuments])

  const addUrl = async (url: string) => {
    setLoading(true)
    try {
      const data = {
        url: url,
      }

      const response = await fetch(`/chat/${courseId}/document/url/github`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          HMS_API_TOKEN: userInfo.chat_token.token,
        },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        message.success('File uploaded.')
        getDocuments()
      } else {
        message.warning(
          `Failed to upload file, please check the file type of linked document`,
        )
      }
    } catch (e) {
      console.log(e)
    } finally {
      setLoading(false)
    }
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
          parseAsPng: isSlideDeck,
        }
        formData.append(
          'source',
          new Blob([JSON.stringify(jsonData)], { type: 'application/json' }),
        )

        const response = await fetch(`/chat/${courseId}/document`, {
          method: 'POST',
          body: formData,
          headers: { HMS_API_TOKEN: userInfo.chat_token.token },
        })

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`)
        }

        message.success(`${file.name} uploaded.`)
        setCountProcessed((prev) => prev + 1)
      } catch (e) {
        message.error(`Failed to upload ${file.name}`)
      }
    }
    getDocuments()
  }

  const handleDeleteDocument = async (record: any) => {
    setLoading(true)
    try {
      const response = await fetch(
        `/chat/${courseId}/${record.docId}/document`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            HMS_API_TOKEN: userInfo.chat_token.token,
          },
        },
      )

      if (!response.ok) {
        throw new Error(`Failed to upload ${File.name}`)
      }

      message.success('Document deleted.')
      getDocuments()
    } catch (e) {
      message.error('Failed to delete document.')
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
    <div className="m-auto my-5">
      <Modal
        title="Add a new document for your chatbot to use."
        open={addDocumentModalOpen}
        onCancel={() => !loading && setAddDocumentModalOpen(false)}
        footer={[
          <Button key="ok" onClick={() => setAddDocumentModalOpen(false)}>
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
                <div className="flex items-center justify-between align-middle">
                  <div className="flex">
                    Parse document as slides{' '}
                    <Tooltip
                      title={
                        'This will generate descriptions for images, which is particularly useful if the document is a slide deck or another image-heavy component'
                      }
                    >
                      <QuestionCircleOutlined className="ml-2" />
                    </Tooltip>
                  </div>
                  <Switch
                    defaultChecked={isSlideDeck}
                    className="mt-0 pt-0"
                    disabled={false}
                    onChange={(checked) => setIsSlideDeck(checked)}
                  />
                </div>
                <p>
                  Preview URL{' '}
                  <Tooltip
                    title={
                      'This preview URL will be used to redirect your students to view this file. Make sure to include http header unless you want to redirect route on this site.'
                    }
                  >
                    <QuestionCircleOutlined className="ml-2" />{' '}
                  </Tooltip>
                </p>
                <Form.Item
                  name="source"
                  rules={[
                    {
                      required: true,
                      message: 'Please provide a document preview URL.',
                    },
                    {
                      type: 'url',
                      message: 'Please enter a valid URL.',
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
          <h3 className="text-4xl font-bold text-gray-900">
            Manage Chatbot Documents and Settings
          </h3>
          <p className="text-[16px] font-medium text-gray-600">
            Configure the chatbot&apos;s parameters and documents that your
            chatbot will have access to.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setChatbotParameterModalOpen(true)}>
            Chatbot Settings
          </Button>
          <Button onClick={() => setAddDocumentModalOpen(true)}>
            Add Document
          </Button>
        </div>
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
        rowSelection={selectViewEnabled ? rowSelection : undefined}
        dataSource={filteredDocuments}
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
        <ChatbotSettingsModal
          open={chatbotParameterModalOpen}
          courseId={courseId}
          onClose={() => setChatbotParameterModalOpen(false)}
        />
      )}
    </div>
  )
}
