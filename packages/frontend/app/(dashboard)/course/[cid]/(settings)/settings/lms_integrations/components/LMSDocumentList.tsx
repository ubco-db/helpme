import {
  DeleteOutlined,
  MoreOutlined,
  SearchOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import {
  LMSAnnouncement,
  LMSAssignment,
  LMSPage,
  LMSResourceType,
} from '@koh/common'
import {
  Badge,
  Button,
  Collapse,
  Input,
  List,
  message,
  Pagination,
  Spin,
} from 'antd'
import { useMemo, useState } from 'react'
import { cn, getErrorMessage } from '@/app/utils/generalUtils'
import { API } from '@/app/api'

type LMSDocumentListProps<T> = {
  courseId: number
  type: 'Assignment' | 'Announcement' | 'Page'
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

export default function LMSDocumentList<
  T extends LMSAssignment | LMSAnnouncement | LMSPage,
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
  ],
}: LMSDocumentListProps<T>) {
  const [page, setPage] = useState(1)
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [syncingItems, setSyncingItems] = useState<Record<string, boolean>>({})

  const typeToResource = useMemo(() => {
    switch (type) {
      case 'Assignment':
        return LMSResourceType.ASSIGNMENTS
      case 'Announcement':
        return LMSResourceType.ANNOUNCEMENTS
      case 'Page':
        return LMSResourceType.PAGES
    }
  }, [type])

  const isItemSyncing = (itemId: string) => {
    return syncingItems[itemId] || false
  }

  const toggleSyncDocument = async (
    doc: LMSAssignment | LMSAnnouncement | LMSPage,
    type: 'Assignment' | 'Announcement' | 'Page',
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
              (d as LMSPage).body.toLowerCase().includes(search.toLowerCase())
            )
          default:
            return false
        }
      }),
    [type, documents, search],
  )

  const paginatedDocuments = useMemo(
    () => matchingDocuments.slice((page - 1) * 20, page * 20),
    [matchingDocuments, page],
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
            'my-2 flex flex-col justify-start md:flex-row md:justify-between'
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

function DocumentList<T extends LMSAssignment | LMSAnnouncement | LMSPage>({
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

function NameCell<T extends LMSAssignment | LMSAnnouncement | LMSPage>({
  item,
  type,
  lmsSynchronize,
}: {
  item: T
  type: 'Assignment' | 'Announcement' | 'Page'
  lmsSynchronize?: boolean
}) {
  const isOutOfDate =
    item != undefined &&
    item.modified != undefined &&
    item.uploaded != undefined &&
    new Date(item.uploaded).getTime() < new Date(item.modified).getTime()

  let ineligible = false
  if (type == 'Assignment') {
    const asAssignment = item as LMSAssignment
    ineligible =
      (asAssignment.description == undefined ||
        asAssignment.description == '') &&
      asAssignment.due == undefined
  }

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

function SyncCell<T extends LMSAssignment | LMSAnnouncement | LMSPage>({
  item,
  type,
  isItemSyncing,
  toggleSyncDocument,
  lmsSynchronize,
}: {
  item: T
  type: 'Assignment' | 'Announcement' | 'Page'
  isItemSyncing: boolean
  toggleSyncDocument: (
    item: T,
    type: 'Assignment' | 'Announcement' | 'Page',
  ) => void
  lmsSynchronize?: boolean
}) {
  let ineligible = false
  if (type == 'Assignment') {
    const asAssignment = item as LMSAssignment
    ineligible =
      (asAssignment.description == undefined ||
        asAssignment.description == '') &&
      asAssignment.due == undefined
  }

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
