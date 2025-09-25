'use client'

import { Button, Input, message, Pagination, Progress, Table } from 'antd'
import {
  ReactElement,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import Link from 'next/link'
import { TableRowSelection } from 'antd/es/table/interface'
import LegacyChatbotSettingsModal from './components/LegacyChatbotSettingsModal'
import Highlighter from 'react-highlight-words'
import AddChatbotDocumentModal from './components/AddChatbotDocumentModal'
import { ChatbotServiceType, SourceDocument } from '@koh/common'
import { FileAddOutlined, SettingOutlined } from '@ant-design/icons'
import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import ChatbotHelpTooltip from '../components/ChatbotHelpTooltip'
import { getErrorMessage } from '@/app/utils/generalUtils'
import ChatbotSettingsModal from '@/app/(dashboard)/course/[cid]/(settings)/settings/chatbot_settings/components/ChatbotSettingsModal'

interface ChatbotPanelProps {
  params: Promise<{ cid: string }>
}
export default function ChatbotSettings(
  props: ChatbotPanelProps,
): ReactElement {
  const params = use(props.params)
  const { userInfo } = useUserInfo()
  const courseId = useMemo(() => Number(params.cid), [params.cid])
  const [chatbotParameterModalOpen, setChatbotParameterModalOpen] =
    useState(false)
  const [addDocumentModalOpen, setAddDocumentModalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectViewEnabled, setSelectViewEnabled] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [chatbotDocuments, setChatbotDocuments] = useState<SourceDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [countProcessed, setCountProcessed] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [courseServiceType, setCourseServiceType] =
    useState<ChatbotServiceType>()

  const rowSelection: TableRowSelection<SourceDocument> = {
    type: 'checkbox',
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys)
    },
  }
  const hasSelected = selectedRowKeys.length > 0

  useEffect(() => {
    const getCourseServiceType = () => {
      return API.chatbot.staffOnly
        .getCourseServiceType(courseId)
        .then((response) => {
          setCourseServiceType(response)
        })
        .catch((err) =>
          message.error(
            `Failed to determine course service type, cannot allow chatbot settings to be edited/viewed: ${getErrorMessage(err)}`,
          ),
        )
    }
    getCourseServiceType().then()
  }, [courseId])

  const handleDeleteSelectedDocuments = async () => {
    try {
      for (const docId of selectedRowKeys) {
        await API.chatbot.staffOnly.deleteDocument(courseId, docId.toString())
        setCountProcessed(countProcessed + 1)
      }
      message.success('Documents deleted.')
      getDocuments()
    } catch (_e) {
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
        <>
          {/*
          In some environments, components which return Promises or arrays do not work.
          This is due to some changes to react and @types/react, and the component
          packages have not been updated to fix these issues.
        */}
          {/* @ts-expect-error Server Component */}
          <Highlighter
            highlightStyle={{ backgroundColor: '#ffc069', padding: 0 }}
            searchWords={[search]}
            autoEscape
            textToHighlight={text ? text.toString() : ''}
          />
        </>
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
      })
      .catch((e) => {
        console.error(e)
        setChatbotDocuments([])
      })
  }, [courseId, setChatbotDocuments])

  useEffect(() => {
    getDocuments()
  }, [getDocuments])

  const filteredDocuments = useMemo(() => {
    return chatbotDocuments.filter((doc) =>
      doc.docName.toLowerCase().includes(search.toLowerCase()),
    )
  }, [search, chatbotDocuments])

  const totalDocuments = useMemo(
    () => filteredDocuments.length,
    [filteredDocuments],
  )

  const paginatedDocuments = useMemo(
    () =>
      filteredDocuments.slice(
        pageSize * (page - 1),
        pageSize * (page - 1) + pageSize,
      ),
    [filteredDocuments, page, pageSize],
  )

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
        <div className="flex flex-col items-center gap-2 lg:flex-row">
          <ChatbotHelpTooltip forPage="chatbot_settings" />
          {courseServiceType != undefined && (
            <Button
              onClick={() => setChatbotParameterModalOpen(true)}
              icon={<SettingOutlined />}
              type="primary"
            >
              Open Settings
            </Button>
          )}
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
        dataSource={paginatedDocuments}
        pagination={false}
      />
      <div className="my-1"></div>
      <Pagination
        style={{ float: 'right' }}
        total={totalDocuments}
        pageSizeOptions={[10, 20, 30, 50]}
        showSizeChanger
        onChange={(page, pageSize) => {
          setPage(page)
          setPageSize(pageSize)
        }}
      />
      {chatbotParameterModalOpen &&
        (courseServiceType == ChatbotServiceType.LEGACY ? (
          <LegacyChatbotSettingsModal
            open={chatbotParameterModalOpen}
            courseId={courseId}
            onClose={() => setChatbotParameterModalOpen(false)}
          />
        ) : (
          <ChatbotSettingsModal
            open={chatbotParameterModalOpen}
            courseId={courseId}
            onClose={() => setChatbotParameterModalOpen(false)}
          />
        ))}
    </div>
  )
}
