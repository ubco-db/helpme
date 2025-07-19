'use client'

import {
  Button,
  Input,
  message,
  Pagination,
  Progress,
  Table,
  TableColumnProps,
  Tag,
} from 'antd'
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
import ChatbotSettingsModal from './components/ChatbotSettingsModal'
import Highlighter from 'react-highlight-words'
import AddChatbotDocumentModal from './components/AddChatbotDocumentModal'
import { SourceDocument } from '@koh/common'
import {
  CloseOutlined,
  FileAddOutlined,
  LoadingOutlined,
  PlusOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import {
  blue,
  cyan,
  gold,
  green,
  magenta,
  orange,
  purple,
  red,
  volcano,
  yellow,
} from '@ant-design/colors'

const colors = [
  blue,
  gold,
  green,
  purple,
  red,
  orange,
  yellow,
  cyan,
  magenta,
  volcano,
]

interface ChatbotPanelProps {
  params: Promise<{ cid: string }>
}

const tagColors: { c0: string; c1: string; c2: string }[] = colors.map((c) => ({
  c0: c[0],
  c1: c[5],
  c2: c[9],
}))

type FormattedDocument = {
  key: string
  docId: string
  docName: string
  pageContent: string // idk what's going on here why is there both a docName and pageContent
  sourceLink: string
  keywords: string[]
  pageNumbers: number[]
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
  const [chatbotDocuments, setChatbotDocuments] = useState<FormattedDocument[]>(
    [],
  )
  const [loading, setLoading] = useState(false)
  const [countProcessed, setCountProcessed] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [isCreating, setIsCreating] = useState<string[]>([])
  const [editingFieldValue, setEditingFieldValue] = useState<
    Record<string, string>
  >({})
  const [isUpdatingKeywords, setIsUpdatingKeywords] = useState(false)

  const rowSelection: TableRowSelection<FormattedDocument> = {
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

  const updateDocumentKeywords = async (
    record: FormattedDocument,
    keyword: string,
    index?: number,
    del = false,
  ) => {
    if (isUpdatingKeywords) return
    setIsUpdatingKeywords(true)

    const newKeywords = del
      ? record.keywords.filter((_, i) => i != index)
      : [...record.keywords, keyword]
    await API.chatbot.staffOnly
      .updateDocumentKeywords(courseId, record.docId.toString(), newKeywords)
      .then((updated) => {
        const temp = [...chatbotDocuments]
        const match = temp.findIndex((c) => c.docId == updated.id)
        if (temp[match] != undefined) {
          temp[match].keywords =
            updated.metadata?.keywords
              ?.split(', ')
              .map((k) => k.trim())
              .filter((k) => k != '') ?? []
        }
        setChatbotDocuments(temp)
      })
      .catch((e) => {
        console.error(e)
        message.error(`Failed to ${del ? 'remove' : 'create'} document keyword`)
      })
      .finally(() => setIsUpdatingKeywords(false))
  }

  const columns: TableColumnProps<FormattedDocument>[] = [
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
      title: 'Keywords',
      dataIndex: 'keywords',
      key: 'keywords',
      render: (keywords: string[], record: any, index) => (
        <div className={'flex flex-wrap gap-1'}>
          {keywords.length > 0 &&
            keywords.map((k, i) => {
              let colorIndex = 0
              for (let j = 0; j < k.length; j++) {
                colorIndex += k.charCodeAt(j)
              }
              colorIndex %= tagColors.length
              const colours = tagColors[colorIndex]
              return (
                <Tag
                  className={'flex items-center justify-center gap-1'}
                  style={{
                    borderColor: colours.c1,
                    color: colours.c1,
                  }}
                  key={`kw-${index}-${i}`}
                  color={colours.c0}
                >
                  <span>{k}</span>
                  <button
                    className={'bg-transparent p-0 hover:bg-transparent'}
                    disabled={isUpdatingKeywords}
                    onClick={async () =>
                      await updateDocumentKeywords(record, k, i, true)
                    }
                  >
                    {isUpdatingKeywords ? (
                      <LoadingOutlined
                        style={{
                          color: colours.c1,
                        }}
                        spin
                      />
                    ) : (
                      <CloseOutlined
                        style={{
                          color: colours.c1,
                        }}
                        onMouseEnter={(e) =>
                          e.currentTarget.style.setProperty('color', colours.c2)
                        }
                        onMouseLeave={(e) =>
                          e.currentTarget.style.setProperty('color', colours.c1)
                        }
                      />
                    )}
                  </button>
                </Tag>
              )
            })}
          <Tag
            className={
              'flex items-center justify-center gap-1 border-dashed border-gray-500 bg-white text-gray-500 focus-within:border-2 focus-within:border-solid focus-within:border-blue-300 hover:border-gray-800 hover:bg-gray-100 hover:text-gray-800 focus-within:hover:border-blue-300 focus-within:hover:bg-white focus-within:hover:text-gray-500'
            }
            key={`kw-${index}-add`}
            onClick={() =>
              !isCreating.some((c) => c == record.docId)
                ? setIsCreating((prev) => [...prev, record.docId])
                : undefined
            }
          >
            {isCreating.some((c) => c == record.docId) ? (
              <span className={'flex'}>
                <input
                  type={'text'}
                  className={
                    'm-0 w-min rounded-none border-none bg-transparent p-0 text-xs outline-none'
                  }
                  placeholder={'Enter keyword'}
                  size={Math.max(
                    10,
                    (editingFieldValue[record.docId] ?? '').length,
                  )}
                  maxLength={20}
                  value={editingFieldValue[record.docId] ?? ''}
                  onChange={(event) =>
                    setEditingFieldValue((prev) => ({
                      ...prev,
                      [record.docId]:
                        event.target?.value
                          .replace(/[^a-zA-Z0-9-_]/g, '')
                          .trim()
                          .slice(0, 20) ?? editingFieldValue[record.docId],
                    }))
                  }
                  onKeyDown={async (key) => {
                    if (key.key == 'Enter') {
                      if (
                        !editingFieldValue[record.docId] ||
                        editingFieldValue[record.docId].trim() == ''
                      )
                        return
                      await updateDocumentKeywords(
                        record,
                        editingFieldValue[record.docId],
                        undefined,
                      )
                      setEditingFieldValue((prev) => ({
                        ...prev,
                        [record.docId]: '',
                      }))
                      setIsCreating((prev) =>
                        prev.filter((r) => r != record.docId),
                      )
                    }
                  }}
                />
                <button
                  className={'bg-transparent p-0 hover:bg-transparent'}
                  disabled={isUpdatingKeywords}
                  onClick={() => {
                    setIsCreating((prev) =>
                      prev.filter((r) => r != record.docId),
                    )
                    setEditingFieldValue((prev) => ({
                      ...prev,
                      [record.docId]: '',
                    }))
                  }}
                >
                  {isUpdatingKeywords ? (
                    <LoadingOutlined
                      className={'border-gray-500 text-gray-500'}
                    />
                  ) : (
                    <CloseOutlined
                      className={
                        'border-gray-500 text-gray-500 hover:border-gray-800 hover:text-gray-800'
                      }
                    />
                  )}
                </button>
              </span>
            ) : (
              <>
                <PlusOutlined /> Add
              </>
            )}
          </Tag>
        </div>
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
        const formattedDocuments: FormattedDocument[] = response.map((doc) => ({
          key: doc.id!,
          docId: doc.id!,
          docName: doc.pageContent,
          pageContent: doc.pageContent, // idk what's going on here why is there both a docName and pageContent
          sourceLink: doc.metadata?.source ?? '',
          keywords:
            doc.metadata?.keywords
              ?.split(', ')
              .map((k) => k.trim())
              .filter((k) => k != '') ?? [],
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
