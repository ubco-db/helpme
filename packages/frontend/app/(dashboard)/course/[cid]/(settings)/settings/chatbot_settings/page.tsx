'use client'

import { Button, Input, Pagination, Progress, Table, message } from 'antd'
import {
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
  use,
} from 'react'
import Link from 'next/link'
import { TableRowSelection } from 'antd/es/table/interface'
import ChatbotSettingsModal from './components/ChatbotSettingsModal'
import Highlighter from 'react-highlight-words'
import AddChatbotDocumentModal from './components/AddChatbotDocumentModal'
import { SourceDocument } from '@koh/common'
import { FileAddOutlined, SettingOutlined } from '@ant-design/icons'
import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'

interface ChatbotPanelProps {
  params: Promise<{ cid: string }>
}
export default function ChatbotSettings(
  props: ChatbotPanelProps,
): ReactElement {
  const params = use(props.params)
  const { userInfo } = useUserInfo()
  const courseId = Number(params.cid)
  const [chatbotParameterModalOpen, setChatbotParameterModalOpen] =
    useState(false)
  const [addDocumentModalOpen, setAddDocumentModalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectViewEnabled, setSelectViewEnabled] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [totalDocuments, setTotalDocuments] = useState(0)
  const [chatbotDocuments, setChatbotDocuments] = useState<SourceDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [countProcessed, setCountProcessed] = useState(0)

  const rowSelection: TableRowSelection<SourceDocument> = {
    type: 'checkbox',
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys)
    },
  }
  const hasSelected = selectedRowKeys.length > 0

  const handleDeleteSelectedDocuments = async () => {
    try {
      for (const docId of selectedRowKeys) {
        await API.chatbot.staffOnly.deleteDocument(courseId, docId.toString())
        setCountProcessed(countProcessed + 1)
      }
      message.success('Documents deleted.')
      getDocuments()
    } catch (e) {
      message.error('Failed to delete documents.')
    } finally {
      setSelectViewEnabled(false)
      setSelectedRowKeys([])
      setLoading(false)
      setCountProcessed(0)
    }
  }

  const handleDeleteDocument = async (record: any) => {
    setLoading(true)
    await API.chatbot.staffOnly
      .deleteDocument(courseId, record.docId.toString())
      .then(() => {
        message.success('Document deleted.')
        getDocuments()
      })
      .catch(() => {
        message.error('Failed to delete document.')
      })
      .finally(() => {
        setLoading(false)
      })
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
        <Link
          href={text}
          target="_blank"
          rel="noopener noreferrer"
          prefetch={false}
        >
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
              className="ml-2"
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
    await API.chatbot.staffOnly
      .getAllAggregateDocuments(courseId)
      .then((response) => {
        const formattedDocuments = response.map((doc) => ({
          key: doc.id,
          docId: doc.id,
          docName: doc.pageContent,
          pageContent: doc.pageContent, // idk what's going on here why is there both a docName and pageContent
          sourceLink: doc.metadata?.source ?? '',
          pageNumbers: [],
        }))
        setChatbotDocuments(formattedDocuments)
        setTotalDocuments(formattedDocuments.length)
      })
      .catch((e) => {
        console.error(e)
        setChatbotDocuments([])
        setTotalDocuments(0)
      })
  }, [courseId, setChatbotDocuments, setTotalDocuments])

  useEffect(() => {
    getDocuments()
  }, [getDocuments])

  const filteredDocuments = useMemo(() => {
    return chatbotDocuments.filter((doc) =>
      doc.docName.toLowerCase().includes(search.toLowerCase()),
    )
  }, [search, chatbotDocuments])

  return (
    <div className="m-auto my-5">
      <title>{`HelpMe | Editing ${userInfo.courses.find((e) => e.course.id === courseId)?.course.name ?? ''} Chatbot`}</title>
      <AddChatbotDocumentModal
        open={addDocumentModalOpen}
        courseId={courseId}
        onClose={() => setAddDocumentModalOpen(false)}
        getDocuments={getDocuments}
      />
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
        <div className="flex flex-col gap-2 md:flex-row">
          <Button
            onClick={() => setChatbotParameterModalOpen(true)}
            icon={<SettingOutlined />}
            type="primary"
          >
            Open Settings
          </Button>
          <Button
            onClick={() => setAddDocumentModalOpen(true)}
            icon={<FileAddOutlined />}
            type="primary"
          >
            Add Documents
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
