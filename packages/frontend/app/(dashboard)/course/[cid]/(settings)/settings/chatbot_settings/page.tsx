'use client'

import {
  Badge,
  Button,
  Input,
  message,
  Pagination,
  Progress,
  Table,
  Tooltip,
} from 'antd'
import { ReactElement, use, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { TableRowSelection } from 'antd/es/table/interface'
import LegacyChatbotSettingsModal from './components/LegacyChatbotSettingsModal'
import Highlighter from 'react-highlight-words'
import AddChatbotDocumentModal from './components/AddChatbotDocumentModal'
import {
  ChatbotDocumentAggregateResponse,
  ChatbotServiceType,
  DocumentType,
  DocumentTypeColorMap,
  DocumentTypeDisplayMap,
  UpdateDocumentAggregateBody,
} from '@koh/common'
import {
  DeleteOutlined,
  EditOutlined,
  FileAddOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import ChatbotHelpTooltip from '../components/ChatbotHelpTooltip'
import { getErrorMessage } from '@/app/utils/generalUtils'
import ChatbotSettingsModal from '@/app/(dashboard)/course/[cid]/(settings)/settings/chatbot_settings/components/ChatbotSettingsModal'
import { getPaginatedChatbotDocuments } from '@/app/(dashboard)/course/[cid]/(settings)/settings/util'
import EditChatbotDocumentModal from '@/app/(dashboard)/course/[cid]/(settings)/settings/chatbot_settings/components/EditChatbotDocumentModal'

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

  const [chatbotDocuments, setChatbotDocuments] = useState<
    ChatbotDocumentAggregateResponse[]
  >([])
  const [totalAggregates, setTotalAggregates] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [editingDocument, setEditingDocument] =
    useState<ChatbotDocumentAggregateResponse>()

  const [loading, setLoading] = useState(false)
  const [countProcessed, setCountProcessed] = useState(0)
  const [courseServiceType, setCourseServiceType] =
    useState<ChatbotServiceType>()

  const rowSelection: TableRowSelection<ChatbotDocumentAggregateResponse> = {
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
      await getPaginatedChatbotDocuments(
        API.chatbot.staffOnly.getAllAggregateDocuments,
        courseId,
        page,
        pageSize,
        setTotalAggregates,
        setChatbotDocuments,
        search,
      )
    } catch (_e) {
      message.error('Failed to delete documents.')
    } finally {
      setSelectViewEnabled(false)
      setSelectedRowKeys([])
      setLoading(false)
      setCountProcessed(0)
    }
  }

  const handleUpdateDocument = async (
    id: string,
    params: UpdateDocumentAggregateBody,
  ) => {
    setLoading(true)
    await API.chatbot.staffOnly
      .updateDocument(courseId, id, params)
      .then(() => {
        message.success('Document updated.')
        getPaginatedChatbotDocuments(
          API.chatbot.staffOnly.getAllAggregateDocuments,
          courseId,
          page,
          pageSize,
          setTotalAggregates,
          setChatbotDocuments,
          search,
        )
      })
      .catch(() => {
        message.error('Failed to update document.')
      })
      .finally(() => {
        setLoading(false)
      })
  }

  const handleDeleteDocument = async (id: string) => {
    setLoading(true)
    await API.chatbot.staffOnly
      .deleteDocument(courseId, id)
      .then(() => {
        message.success('Document deleted.')
        getPaginatedChatbotDocuments(
          API.chatbot.staffOnly.getAllAggregateDocuments,
          courseId,
          page,
          pageSize,
          setTotalAggregates,
          setChatbotDocuments,
          search,
        )
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
      dataIndex: 'title',
      key: 'title',
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
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: '10%',
      render: (type: DocumentType) => (
        <Badge
          count={DocumentTypeDisplayMap[type] ?? (DocumentType as any)[type]}
          color={DocumentTypeColorMap[type] ?? '#7C7C7C'}
        />
      ),
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      width: '10%',
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
        <div className={'flex gap-1'}>
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
        </div>
      ),
      key: 'action',
      width: '10%',
      render: (_: any, record: ChatbotDocumentAggregateResponse) =>
        !selectViewEnabled && (
          <div className={'flex flex-col gap-1'}>
            <Tooltip
              title={
                record.lmsDocumentId != undefined
                  ? 'LMS documents cannot be edited.'
                  : undefined
              }
            >
              <Button
                disabled={loading || record.lmsDocumentId != undefined}
                icon={<EditOutlined />}
                variant={'outlined'}
                color={'blue'}
                onClick={() => setEditingDocument(record)}
              >
                Edit
              </Button>
            </Tooltip>
            <Button
              disabled={loading}
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteDocument(record.id)}
              danger
            >
              Delete
            </Button>
          </div>
        ),
    },
  ]

  useEffect(() => {
    getPaginatedChatbotDocuments(
      API.chatbot.staffOnly.getAllAggregateDocuments,
      courseId,
      page,
      pageSize,
      setTotalAggregates,
      setChatbotDocuments,
      search,
    )
  }, [courseId, page, pageSize, search])

  return (
    <div className="m-auto my-5">
      <title>{`HelpMe | Editing ${userInfo.courses.find((e) => e.course.id === courseId)?.course.name ?? ''} Chatbot`}</title>
      <AddChatbotDocumentModal
        open={addDocumentModalOpen}
        courseId={courseId}
        onClose={() => setAddDocumentModalOpen(false)}
        getDocumentsProxy={() => {
          getPaginatedChatbotDocuments(
            API.chatbot.staffOnly.getAllAggregateDocuments,
            courseId,
            page,
            pageSize,
            setTotalAggregates,
            setChatbotDocuments,
            search,
          )
        }}
      />
      {editingDocument != undefined && (
        <EditChatbotDocumentModal
          editingDocument={editingDocument}
          updateDocument={(id: string, params: UpdateDocumentAggregateBody) =>
            handleUpdateDocument(id, params)
          }
          onCancel={() => setEditingDocument(undefined)}
        />
      )}
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

      <div className={'flex justify-between gap-2'}>
        <Input
          placeholder={'Search document name...'}
          // prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => {
            e.preventDefault()
            setSearch(e.target.value)
          }}
          onPressEnter={() => {
            setPage(1)
            getPaginatedChatbotDocuments(
              API.chatbot.staffOnly.getAllAggregateDocuments,
              courseId,
              page,
              pageSize,
              setTotalAggregates,
              setChatbotDocuments,
              search,
            )
          }}
        />
        <Pagination
          style={{ float: 'right' }}
          total={totalAggregates}
          pageSizeOptions={[10, 20, 30, 50]}
          showSizeChanger
          current={page}
          pageSize={pageSize}
          onChange={(page, pageSize) => {
            setPage(page)
            setPageSize(pageSize)
          }}
        />
      </div>
      <Table<ChatbotDocumentAggregateResponse>
        columns={columns}
        rowKey={'id'}
        rowSelection={selectViewEnabled ? rowSelection : undefined}
        dataSource={chatbotDocuments}
        pagination={false}
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
