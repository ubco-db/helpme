import {
  CloseOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  SearchOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import {
  CommonMimeToExtensionMap,
  LMSAnnouncement,
  LMSAssignment,
  LMSFile,
  LMSPage,
  LMSResourceType,
  SupportedLMSFileTypes,
} from '@koh/common'
import {
  Badge,
  Button,
  Collapse,
  Input,
  List,
  message,
  Pagination,
  Select,
  Spin,
  Tooltip,
} from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { cn, getErrorMessage } from '@/app/utils/generalUtils'
import { API } from '@/app/api'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type LMSDocumentListProps<T> = {
  courseId: number
  type: 'Assignment' | 'Announcement' | 'Page' | 'File'
  documents: T[]
  loadingLMSData?: boolean
  lmsSynchronize?: boolean
  onUpdateCallback?: () => void
  selectedResourceTypes?: LMSResourceType[]
}

type LMSDocumentListColumn = {
  dataIndex: string
  header: string
  cellFormat: (
    item: any,
  ) => React.ReactNode | React.JSX.Element | string | number
  colSpan: 1 | 2 | 3 | 4
}

const isDocIneligible = <
  T extends LMSAssignment | LMSAnnouncement | LMSPage | LMSFile,
>(
  item: T,
  type: 'Assignment' | 'Announcement' | 'Page' | 'File',
) => {
  if (type == 'Assignment') {
    const asAssignment = item as LMSAssignment
    return (
      (asAssignment.description == undefined ||
        asAssignment.description == '') &&
      asAssignment.due == undefined
    )
  } else if (type == 'File') {
    const asFile = item as LMSFile
    return !(Object.values(SupportedLMSFileTypes) as string[]).includes(
      asFile.contentType,
    )
  }
  return false
}

export default function LMSDocumentList<
  T extends LMSAssignment | LMSAnnouncement | LMSPage | LMSFile,
>({
  courseId,
  type,
  documents,
  loadingLMSData = false,
  lmsSynchronize,
  onUpdateCallback = () => undefined,
  selectedResourceTypes = [
    LMSResourceType.ANNOUNCEMENTS,
    LMSResourceType.ASSIGNMENTS,
    LMSResourceType.PAGES,
    LMSResourceType.FILES,
  ],
}: LMSDocumentListProps<T>) {
  const router = useRouter()
  const pathName = usePathname()
  const searchParams = useSearchParams()

  const [page, setPage] = useState(
    !isNaN(parseInt(searchParams.get('p') ?? ''))
      ? parseInt(searchParams.get('p') as string)
      : 1,
  )
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [syncingItems, setSyncingItems] = useState<Record<string, boolean>>({})
  const [selectedFilters, setSelectedFilters] = useState<(1 | 2 | 3)[]>([
    1, 2, 3,
  ])

  useEffect(() => {
    const params = new URLSearchParams({
      tab: type.toLowerCase(),
      p: String(page),
    })
    router.push(`${pathName}?${params.toString()}`, { scroll: false })
  }, [type, page, pathName, router])

  const typeToResource = useMemo(() => {
    switch (type) {
      case 'Assignment':
        return LMSResourceType.ASSIGNMENTS
      case 'Announcement':
        return LMSResourceType.ANNOUNCEMENTS
      case 'Page':
        return LMSResourceType.PAGES
      case 'File':
        return LMSResourceType.FILES
    }
  }, [type])

  const isItemSyncing = (itemId: string) => {
    return syncingItems[itemId] || false
  }

  const toggleSyncDocument = async (
    doc: LMSAssignment | LMSAnnouncement | LMSPage | LMSFile,
    type: 'Assignment' | 'Announcement' | 'Page' | 'File',
  ) => {
    const docIdStr = doc.id.toString()

    const thenFx = (result?: string) => {
      if (result) {
        message.success(result)
        onUpdateCallback()
      } else {
        throw new Error('Unknown error occurred')
      }
    }

    const errFx = (err: Error) => {
      message.error(getErrorMessage(err))
    }

    const finallyFx = () => {
      setSyncingItems((prev) => ({
        ...prev,
        [docIdStr]: false,
      }))
    }

    setSyncingItems((prev) => ({
      ...prev,
      [docIdStr]: true,
    }))

    switch (type) {
      case 'Announcement':
        return await API.lmsIntegration
          .toggleSyncAnnouncement(courseId, doc.id, doc as LMSAnnouncement)
          .then(thenFx)
          .catch(errFx)
          .finally(finallyFx)
      case 'Assignment':
        return await API.lmsIntegration
          .toggleSyncAssignment(courseId, doc.id, doc as LMSAssignment)
          .then(thenFx)
          .catch(errFx)
          .finally(finallyFx)
      case 'Page':
        return await API.lmsIntegration
          .toggleSyncPage(courseId, doc.id, doc as LMSPage)
          .then(thenFx)
          .catch(errFx)
          .finally(finallyFx)
      case 'File':
        return await API.lmsIntegration
          .toggleSyncFile(courseId, doc.id, doc as LMSFile)
          .then(thenFx)
          .catch(errFx)
          .finally(finallyFx)
    }
  }

  const columns = useMemo(() => {
    switch (type) {
      case 'Announcement':
        return [
          {
            dataIndex: 'title',
            header: 'Title',
            cellFormat: (item: T) => (
              <NameCell
                item={item}
                type={type}
                lmsSynchronize={lmsSynchronize}
              />
            ),
            colSpan: 2,
          },
          {
            dataIndex: 'posted',
            header: 'Posted',
            cellFormat: (item: string | undefined) =>
              item != undefined && item.trim() != ''
                ? new Date(item).toLocaleDateString()
                : '',
            colSpan: 1,
          },
          {
            dataIndex: 'message',
            header: 'Message',
            cellFormat: (item: string) =>
              (item != undefined && item.length > 0 && (
                <div
                  dangerouslySetInnerHTML={{
                    __html: item,
                  }}
                ></div>
              )) || <i>No message</i>,
            colSpan: 3,
          },
          {
            dataIndex: 'sync',
            header: 'Actions',
            cellFormat: (item: T) => {
              if (selectedResourceTypes?.includes(typeToResource)) {
                return (
                  <SyncCell
                    item={item}
                    type={type}
                    toggleSyncDocument={toggleSyncDocument}
                    isItemSyncing={isItemSyncing(item.id.toString())}
                    lmsSynchronize={lmsSynchronize}
                  />
                )
              } else return null
            },
            colSpan: 1,
          },
        ] as LMSDocumentListColumn[]
      case 'Assignment':
        return [
          {
            dataIndex: 'name',
            header: 'Name',
            cellFormat: (item: T) => (
              <NameCell
                item={item}
                type={type}
                lmsSynchronize={lmsSynchronize}
              />
            ),
            colSpan: 2,
          },
          {
            dataIndex: 'due',
            header: 'Due Date',
            cellFormat: (item: string | undefined) =>
              item != undefined && item.trim() != ''
                ? new Date(item).toLocaleDateString()
                : '',
            colSpan: 1,
          },
          {
            dataIndex: 'description',
            header: 'Description',
            cellFormat: (item: string) =>
              (item != undefined && item.length > 0 && (
                <Collapse>
                  <Collapse.Panel key={'def'} header={'Description'}>
                    <div
                      dangerouslySetInnerHTML={{
                        __html: item,
                      }}
                    ></div>
                  </Collapse.Panel>
                </Collapse>
              )) || <i>No description</i>,
            colSpan: 4,
          },
          {
            dataIndex: 'sync',
            header: 'Actions',
            cellFormat: (item: T) => {
              if (selectedResourceTypes?.includes(typeToResource)) {
                return (
                  <SyncCell
                    item={item}
                    type={type}
                    toggleSyncDocument={toggleSyncDocument}
                    isItemSyncing={isItemSyncing(item.id.toString())}
                    lmsSynchronize={lmsSynchronize}
                  />
                )
              } else return null
            },
            colSpan: 1,
          },
        ] as LMSDocumentListColumn[]
      case 'Page':
        return [
          {
            dataIndex: 'title',
            header: 'Title',
            cellFormat: (item: T) => (
              <NameCell
                item={item}
                type={'Page'}
                lmsSynchronize={lmsSynchronize}
              />
            ),
            colSpan: 2,
          },
          {
            dataIndex: 'updated',
            header: 'Last Updated',
            cellFormat: (item: string | undefined) =>
              item != undefined && item.trim() != ''
                ? new Date(item).toLocaleDateString()
                : '',
            colSpan: 1,
          },
          {
            dataIndex: 'body',
            header: 'Content',
            cellFormat: (item: string) =>
              (item != undefined && item.length > 0 && (
                <Collapse>
                  <Collapse.Panel key={'def'} header={'Content'}>
                    <div
                      dangerouslySetInnerHTML={{
                        __html: item,
                      }}
                    ></div>
                  </Collapse.Panel>
                </Collapse>
              )) || <i>No content</i>,
            colSpan: 3,
          },
          {
            dataIndex: 'sync',
            header: 'Actions',
            cellFormat: (item: T) => {
              if (selectedResourceTypes?.includes(typeToResource)) {
                return (
                  <SyncCell
                    item={item}
                    type={type}
                    toggleSyncDocument={toggleSyncDocument}
                    isItemSyncing={isItemSyncing(item.id.toString())}
                    lmsSynchronize={lmsSynchronize}
                  />
                )
              } else return null
            },
            colSpan: 1,
          },
        ] as LMSDocumentListColumn[]
      case 'File':
        return [
          {
            dataIndex: 'name',
            header: 'Name',
            cellFormat: (item: T) => (
              <NameCell
                item={item}
                type={'File'}
                lmsSynchronize={lmsSynchronize}
              />
            ),
            colSpan: 2,
          },
          {
            dataIndex: 'modified',
            header: 'Last Modified',
            cellFormat: (item: string | undefined) =>
              item != undefined && item.trim() != ''
                ? new Date(item).toLocaleDateString()
                : '',
            colSpan: 1,
          },
          {
            dataIndex: 'contentType',
            header: 'File Type',
            cellFormat: (item: string) =>
              (Object.keys(CommonMimeToExtensionMap).find(
                (k) =>
                  (CommonMimeToExtensionMap as Record<string, string>)[k] ==
                  item,
              ) ??
                item) ||
              'Unknown',
            colSpan: 1,
          },
          {
            dataIndex: 'size',
            header: 'Size',
            cellFormat: (item: number) => {
              if (!item) return 'Unknown'
              if (item < 1024) return `${item} B`
              if (item < 1024 * 1024) return `${(item / 1024).toFixed(1)} KB`
              if (item < 1024 * 1024 * 1024)
                return `${(item / (1024 * 1024)).toFixed(1)} MB`
              return `${(item / (1024 * 1024 * 1024)).toFixed(1)} GB`
            },
            colSpan: 1,
          },
          {
            dataIndex: 'sync',
            header: 'Actions',
            cellFormat: (item: T) => {
              if (selectedResourceTypes?.includes(typeToResource)) {
                return (
                  <SyncCell
                    item={item}
                    type={type}
                    toggleSyncDocument={toggleSyncDocument}
                    isItemSyncing={isItemSyncing(item.id.toString())}
                    lmsSynchronize={lmsSynchronize}
                  />
                )
              } else return null
            },
            colSpan: 1,
          },
        ] as LMSDocumentListColumn[]
      default:
        return []
    }
  }, [type, syncingItems, lmsSynchronize, toggleSyncDocument])

  const ncols = useMemo(
    () => columns.reduce((acc, column) => acc + column.colSpan, 0),
    [columns],
  )

  const handleSearch = (event: any) => {
    event.preventDefault()
    setSearch(event.target.value)
    setPage(1)
  }

  const matchingDocuments = useMemo(
    () =>
      documents.filter((d) => {
        switch (type) {
          case 'Announcement':
            return (
              (d as LMSAnnouncement).title
                .toLowerCase()
                .includes(search.toLowerCase()) ||
              (d as LMSAnnouncement).message
                .toLowerCase()
                .includes(search.toLowerCase()) ||
              (typeof (d as LMSAnnouncement).posted === 'string'
                ? new Date((d as LMSAnnouncement).posted)
                : (d as LMSAnnouncement).posted
              )
                .toLocaleDateString()
                .toLowerCase()
                .includes(search.toLowerCase())
            )
          case 'Assignment':
            return (
              (d as LMSAssignment).name
                .toLowerCase()
                .includes(search.toLowerCase()) ||
              (d as LMSAssignment).description
                .toLowerCase()
                .includes(search.toLowerCase())
            )
          case 'Page':
            return (
              (d as LMSPage).title
                .toLowerCase()
                .includes(search.toLowerCase()) ||
              (d as LMSPage).body?.toLowerCase().includes(search.toLowerCase())
            )
          case 'File':
            return (
              (d as LMSFile).name
                .toLowerCase()
                .includes(search.toLowerCase()) ||
              (d as LMSFile).contentType
                .toLowerCase()
                .includes(search.toLowerCase())
            )
          default:
            return false
        }
      }),
    [type, documents, search],
  )

  const filteredDocuments = useMemo(
    () =>
      matchingDocuments.filter((doc: T) => {
        return selectedFilters
          .map((filter) => {
            switch (filter) {
              case 1:
                return doc.uploaded != undefined
              case 2:
                return doc.uploaded == undefined && !isDocIneligible(doc, type)
              case 3:
                return isDocIneligible(doc, type)
            }
          })
          .reduce((p, c) => p || c, false)
      }),
    [matchingDocuments, type, selectedFilters],
  )

  const paginatedDocuments = useMemo(
    () => filteredDocuments.slice((page - 1) * 20, page * 20),
    [filteredDocuments, page],
  )

  if (!documents) {
    return (
      <div className={'h-full w-full'}>
        <Spin tip="Loading..." size="large" />
      </div>
    )
  } else {
    return (
      <div className="bg-white">
        <div
          className={
            'my-2 flex flex-col justify-start gap-2 md:flex-row md:justify-between'
          }
        >
          <Input
            placeholder={`Search for ${type.toLowerCase()} and press enter`}
            prefix={<SearchOutlined />}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={handleSearch}
          />
          {matchingDocuments.length > 20 && (
            <Pagination
              style={{ float: 'right' }}
              current={page}
              pageSize={20}
              total={matchingDocuments.length}
              onChange={(page) => setPage(page)}
              showSizeChanger={false}
            />
          )}
        </div>
        <div
          className={
            'my-2 flex flex-col justify-start gap-2 md:flex-row md:justify-between'
          }
        >
          <div className={'flex items-center gap-2'}>
            <Tooltip
              title={
                'Set whether you want to see uploaded, not uploaded, or unable to be uploaded documents.'
              }
            >
              <span className={'font-semibold'}>
                Filters <InfoCircleOutlined />:
              </span>
            </Tooltip>
            <Select
              popupMatchSelectWidth={false}
              value={selectedFilters}
              tagRender={(tagProps) => (
                <div
                  data-show="true"
                  className={cn(
                    tagProps.value == 1
                      ? 'bg-[#52c41a]'
                      : tagProps.value == 2
                        ? 'bg-[#f5222d]'
                        : 'bg-[#fadb14]',
                    'mx-1 flex h-fit items-center justify-center gap-1 rounded-full px-1 py-0.5 text-xs text-white',
                  )}
                >
                  <div>
                    {((i: number) => {
                      switch (i) {
                        case 1:
                          return 'Synced'
                        case 2:
                          return 'Not Synced'
                        case 3:
                          return "Can't Sync"
                      }
                    })(tagProps.value)}
                  </div>
                  <button
                    className={
                      'aspect-square border-none bg-transparent text-xs text-white transition-all hover:text-gray-500'
                    }
                    onClick={tagProps.onClose}
                  >
                    <CloseOutlined />
                  </button>
                </div>
              )}
              onChange={(value: (1 | 2 | 3)[]) => setSelectedFilters(value)}
              mode={'multiple'}
            >
              <Select.Option value={1}>
                <Badge color={'green'} count={'Synced'} />
              </Select.Option>
              <Select.Option value={2}>
                <Badge color={'red'} count={'Not Synced'} />
              </Select.Option>
              <Select.Option value={3}>
                <Badge color={'yellow'} count={"Can't Sync"} />
              </Select.Option>
            </Select>
          </div>
        </div>
        <DocumentList
          documents={paginatedDocuments}
          loadingLMSData={loadingLMSData}
          ncols={ncols}
          columns={columns}
        />
      </div>
    )
  }
}

function DocumentList<
  T extends LMSAssignment | LMSAnnouncement | LMSPage | LMSFile,
>({
  documents,
  loadingLMSData,
  ncols,
  columns,
}: {
  documents: T[]
  loadingLMSData: boolean
  ncols: number
  columns: LMSDocumentListColumn[]
}) {
  const colClassString = cn(
    'grid',
    ncols == 1 ? 'grid-cols-1' : '',
    ncols == 2 ? 'grid-cols-2' : '',
    ncols == 3 ? 'grid-cols-3' : '',
    ncols == 4 ? 'grid-cols-4' : '',
    ncols == 5 ? 'grid-cols-5' : '',
    ncols == 6 ? 'grid-cols-6' : '',
    ncols == 7 ? 'grid-cols-7' : '',
    ncols == 8 ? 'grid-cols-8' : '',
    ncols == 9 ? 'grid-cols-9' : '',
    ncols == 10 ? 'grid-cols-10' : '',
    ncols == 11 ? 'grid-cols-11' : '',
    ncols == 12 ? 'grid-cols-12' : '',
  )
  return (
    <List
      dataSource={documents}
      loading={loadingLMSData}
      size="small"
      header={
        <div className={cn('-my-3 bg-gray-100 font-semibold', colClassString)}>
          {columns.map((col: LMSDocumentListColumn, index: number) => (
            <div
              key={`header-col-${index}`}
              className={cn(
                'flex flex-row justify-between border border-gray-200 p-2',
                col.colSpan == 2 ? 'col-span-2' : '',
                col.colSpan == 3 ? 'col-span-3' : '',
                col.colSpan == 4 ? 'col-span-4' : '',
              )}
            >
              <span>{col.header}</span>
            </div>
          ))}
        </div>
      }
      renderItem={(item: { [key: string]: any }) => (
        <div className={colClassString}>
          {columns.map((col: LMSDocumentListColumn, index: number) => (
            <div
              key={`column-${index}`}
              className={cn(
                'overflow-hidden border border-gray-100 p-2 py-3',
                col.colSpan == 2 ? 'col-span-2' : '',
                col.colSpan == 3 ? 'col-span-3' : '',
                col.colSpan == 4 ? 'col-span-4' : '',
              )}
            >
              <div className={'flex w-full items-center justify-between'}>
                {col.cellFormat(
                  col.dataIndex == 'name' ||
                    col.dataIndex == 'title' ||
                    col.dataIndex == 'sync'
                    ? item
                    : item[col.dataIndex],
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    ></List>
  )
}

function NameCell<
  T extends LMSAssignment | LMSAnnouncement | LMSPage | LMSFile,
>({
  item,
  type,
  lmsSynchronize,
}: {
  item: T
  type: 'Assignment' | 'Announcement' | 'Page' | 'File'
  lmsSynchronize?: boolean
}) {
  const isOutOfDate =
    item != undefined &&
    item.modified != undefined &&
    item.uploaded != undefined &&
    new Date(item.uploaded).getTime() < new Date(item.modified).getTime()

  const ineligible = isDocIneligible(item, type)
  return (
    <div className={'flex w-full flex-row items-center justify-between'}>
      <div className={'flex flex-col gap-1'}>
        <span className={'font-semibold'}>
          {'name' in item ? item.name : 'title' in item ? item.title : ''}
        </span>
        {lmsSynchronize && (
          <Badge
            color={
              ineligible
                ? 'yellow'
                : item.uploaded != undefined
                  ? 'green'
                  : 'red'
            }
            count={
              ineligible
                ? "Can't Sync"
                : item.uploaded != undefined
                  ? 'Synced'
                  : 'Not Synced'
            }
          />
        )}
      </div>
      {isOutOfDate && <Badge count={'Out of Date'} />}
    </div>
  )
}

function SyncCell<
  T extends LMSAssignment | LMSAnnouncement | LMSPage | LMSFile,
>({
  item,
  type,
  isItemSyncing,
  toggleSyncDocument,
  lmsSynchronize,
}: {
  item: T
  type: 'Assignment' | 'Announcement' | 'Page' | 'File'
  isItemSyncing: boolean
  toggleSyncDocument: (
    item: T,
    type: 'Assignment' | 'Announcement' | 'Page' | 'File',
  ) => void
  lmsSynchronize?: boolean
}) {
  const ineligible = isDocIneligible(item, type)
  if (ineligible) {
    return null
  }

  if (lmsSynchronize && !item.syncEnabled) {
    const tooltipText =
      item.uploaded != undefined ? 'Enable sync' : 'Force sync'
    return (
      <Button
        onClick={() => toggleSyncDocument(item, type)}
        icon={<SyncOutlined />}
        color={'blue'}
        variant={'outlined'}
        loading={isItemSyncing}
        size="middle"
        className="h-8 w-full"
        title={tooltipText}
      >
        <span className="hidden md:inline">{tooltipText}</span>
      </Button>
    )
  }

  if (item.syncEnabled) {
    const tooltipText = !lmsSynchronize ? 'Delete' : 'Disable sync'
    return (
      <Button
        onClick={() => toggleSyncDocument(item, type)}
        icon={<DeleteOutlined />}
        color={'danger'}
        variant={'outlined'}
        loading={isItemSyncing}
        size="middle"
        className="h-8 w-full"
        title={tooltipText}
      >
        <span className="hidden md:inline">{tooltipText}</span>
      </Button>
    )
  }

  return null
}
