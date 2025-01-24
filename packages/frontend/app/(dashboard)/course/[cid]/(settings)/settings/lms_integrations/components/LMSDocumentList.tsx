import { SearchOutlined } from '@ant-design/icons'
import { LMSAnnouncement, LMSAssignment } from '@koh/common'
import { Badge, Collapse, Input, List, Pagination, Spin } from 'antd'
import { useCallback, useMemo, useState } from 'react'
import { cn } from '@/app/utils/generalUtils'

type LMSDocumentListProps<T> = {
  type: 'Assignment' | 'Announcement'
  documents: T[]
  loadingLMSData?: boolean
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
  T extends LMSAssignment | LMSAnnouncement,
>({ type, documents, loadingLMSData = false }: LMSDocumentListProps<T>) {
  const [page, setPage] = useState(1)
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')

  const getStatusCell = useCallback(
    (item: T) => {
      const isOutOfDate =
        item != undefined &&
        item.modified != undefined &&
        item.uploaded != undefined &&
        new Date(item.uploaded).getTime() < new Date(item.modified).getTime()

      const saved = item.uploaded != undefined && (
        <div className={'flex flex-col gap-1'}>
          <div className={'font-semibold'}>Synchronized with HelpMe</div>
          <div>Last update: {new Date(item.uploaded).toLocaleDateString()}</div>
        </div>
      )

      const ineligible =
        type == 'Assignment' &&
        (!('due' in item) ||
          !('description' in item) ||
          ('description' in item &&
            item.description.trim() == '' &&
            !('due' in item)))
      return (
        <div className={'flex flex-col gap-2'}>
          {isOutOfDate ? (
            <Badge.Ribbon color={'red'} text={'Out of Date!'}>
              {saved}
            </Badge.Ribbon>
          ) : (
            saved
          )}
          {ineligible ? (
            <div className={'italic'}>
              Cannot be synchronized (no relevant information)
            </div>
          ) : (
            item.uploaded == undefined && (
              <div className={'font-semibold italic'}>
                Not synchronized with HelpMe
              </div>
            )
          )}
        </div>
      )
    },
    [type],
  )

  const columns = useMemo(() => {
    switch (type) {
      case 'Announcement':
        return [
          {
            dataIndex: 'id',
            header: 'Announcement ID',
            cellFormat: (item: number) => item,
            colSpan: 1,
          },
          {
            dataIndex: 'title',
            header: 'Title',
            cellFormat: (item: string) => item,
            colSpan: 1,
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
            dataIndex: 'status',
            header: 'Status',
            cellFormat: (item: T) => getStatusCell(item),
            colSpan: 1,
          },
        ] as LMSDocumentListColumn[]
      case 'Assignment':
        return [
          {
            dataIndex: 'id',
            header: 'Assignment ID',
            cellFormat: (item: number) => item,
            colSpan: 1,
          },
          {
            dataIndex: 'name',
            header: 'Name',
            cellFormat: (item: string) => item,
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
            dataIndex: 'status',
            header: 'Status',
            cellFormat: (item: T) => getStatusCell(item),
            colSpan: 1,
          },
        ] as LMSDocumentListColumn[]
      default:
        return []
    }
  }, [getStatusCell, type])

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
              (d as LMSAnnouncement).posted
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

  const renderDocumentList = (documents: T[]) => {
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
          <div
            className={cn('-my-3 bg-gray-100 font-semibold', colClassString)}
          >
            {columns.map((col: LMSDocumentListColumn, index: number) => (
              <div
                key={`header-col-${index}`}
                className={cn(
                  'border border-gray-200 p-4',
                  col.colSpan == 2 ? 'col-span-2' : '',
                  col.colSpan == 3 ? 'col-span-3' : '',
                  col.colSpan == 4 ? 'col-span-4' : '',
                )}
              >
                {col.header}
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
                  'flex items-center justify-between border border-gray-100 p-4',
                  col.colSpan == 2 ? 'col-span-2' : '',
                  col.colSpan == 3 ? 'col-span-3' : '',
                  col.colSpan == 4 ? 'col-span-4' : '',
                )}
              >
                <div>
                  {col.cellFormat(
                    col.dataIndex == 'status' ? item : item[col.dataIndex],
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      ></List>
    )
  }

  if (!documents) {
    return (
      <div className={'h-full w-full'}>
        <Spin tip="Loading..." size="large" />
      </div>
    )
  } else {
    return (
      <div>
        <div className="bg-white">
          <div
            className={
              'my-2 flex flex-col justify-start md:flex-row md:justify-between'
            }
          >
            <Input
              placeholder={'Search for assignments and press enter'}
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
          {renderDocumentList(paginatedDocuments)}
        </div>
      </div>
    )
  }
}
