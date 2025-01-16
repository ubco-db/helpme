import { SearchOutlined } from '@ant-design/icons'
import { LMSAnnouncement, LMSAssignment, LMSFileResult } from '@koh/common'
import {
  Button,
  Collapse,
  Input,
  List,
  message,
  Modal,
  Pagination,
  Radio,
  Spin,
} from 'antd'
import { useCallback, useMemo, useState } from 'react'
import { API } from '@/app/api'
import { cn, getErrorMessage } from '@/app/utils/generalUtils'

type LMSDocumentListProps<T> = {
  type: 'Assignment' | 'Announcement'
  courseId: number
  documents: T[]
  updateCallback: () => void
  loadingLMSData?: boolean
}

type LMSDocumentListColumn = {
  dataIndex: string
  header: string
  cellFormat: (
    item: any,
  ) => React.ReactNode | React.JSX.Element | string | number
  colSpan: 1 | 2 | 3 | 4
  selectable?: boolean
}

export default function LMSDocumentList<
  T extends LMSAssignment | LMSAnnouncement,
>({
  type,
  courseId,
  documents,
  updateCallback,
  loadingLMSData = false,
}: LMSDocumentListProps<T>) {
  const [page, setPage] = useState(1)
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<number[]>([])

  const getStatusCell = useCallback((item: T) => {
    return (
      <div className={'flex flex-col gap-2'}>
        {item.saved && (
          <div className={'font-semibold'}>Saved to HelpMe database</div>
        )}
        {item.uploaded != undefined && (
          <div className={'flex flex-col gap-1'}>
            <div className={'font-semibold'}>Uploaded to HelpMe Chatbot</div>
            <div className={'italic'}>
              Last updated: {item.uploaded.toLocaleDateString()}
            </div>
            {item.modified != undefined &&
              new Date(item.uploaded).getTime() <
                new Date(item.modified).getTime() && (
                <div className={'font-semibold'}>
                  Chatbot Document Out-of-Date!
                </div>
              )}
          </div>
        )}
        {!item.saved && item.uploaded == undefined && (
          <div className={'font-semibold italic'}>Not saved to HelpMe</div>
        )}
      </div>
    )
  }, [])

  const columns = useMemo(() => {
    switch (type) {
      case 'Announcement':
        return [
          {
            selectable: true,
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
            selectable: true,
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

  const toggleSelect = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i != id) : [id, ...prev],
    )
  }

  const handleInput = (event: any) => {
    event.preventDefault()
    setInput(event.target.value)
  }

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

  const eligibleToDelete = useMemo(
    () => documents.filter((d) => d.uploaded != undefined),
    [documents],
  )

  const selectedEligible = useMemo(
    () => eligibleToDelete.filter((d) => selected.includes(d.id)),
    [eligibleToDelete, selected],
  )

  const uploadOrDeleteFiles = async (
    action: 'Upload' | 'Delete',
    all?: boolean,
  ) => {
    const text = action == 'Upload' ? 'upload to' : 'delete from'
    const textTo =
      action == 'Upload'
        ? 'uploading LMS documents to'
        : 'deleting LMS documents from'

    if (selected.length <= 0 && !all) {
      message.warning(
        `Must select at least one LMS document to ${text} HelpMe chatbot.`,
      )
    }

    const thenFx = (response: LMSFileResult[]) => {
      if (response == undefined) {
        throw new Error(
          `Unknown error occurred when ${textTo} HelpMe database.`,
        )
      } else {
        return response
      }
    }

    const errorFx = (error: any) => {
      message.error(getErrorMessage(error))
      return []
    }

    let results: LMSFileResult[] = []
    switch (type) {
      case 'Announcement': {
        switch (action) {
          case 'Upload':
            results = await API.lmsIntegration
              .uploadAnnouncements(courseId, all ? undefined : selected)
              .then(thenFx)
              .catch(errorFx)
            break
          case 'Delete':
            results = await API.lmsIntegration
              .removeAnnouncements(
                courseId,
                all
                  ? eligibleToDelete.map((d) => d.id)
                  : selectedEligible.map((d) => d.id),
              )
              .then(thenFx)
              .catch(errorFx)
            break
        }
        break
      }
      case 'Assignment': {
        switch (action) {
          case 'Upload':
            results = await API.lmsIntegration
              .uploadAssignments(courseId, all ? undefined : selected)
              .then(thenFx)
              .catch(errorFx)
            break
          case 'Delete':
            results = await API.lmsIntegration
              .removeAssignments(
                courseId,
                all
                  ? eligibleToDelete.map((d) => d.id)
                  : selectedEligible.map((d) => d.id),
              )
              .then(thenFx)
              .catch(errorFx)
            break
        }
        break
      }
    }

    updateCallback()

    if (results.length > 0) {
      Modal.info({
        title: `${type} Documents ${action} Result`,
        content: (
          <div>
            <List
              dataSource={results}
              header={
                <div className={'grid-cols-2 bg-gray-100 font-semibold'}>
                  <div className={'border border-gray-200 p-2'}>{type} ID</div>
                  <div>Result</div>
                </div>
              }
              renderItem={(item: LMSFileResult, index: number) => (
                <List.Item key={`list-item-${index}`}>
                  <div className={'grid-cols-2'}>
                    <div className={'border border-gray-100 p-2'}>
                      {item.id}
                    </div>
                    <div className={'border border-gray-100 p-2'}>
                      {item.success
                        ? action == 'Upload'
                          ? 'Uploaded'
                          : 'Deleted'
                        : 'Failure'}
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </div>
        ),
        footer: null,
      })
    }
  }

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
                  'border border-gray-100 p-4',
                  col.colSpan == 2 ? 'col-span-2' : '',
                  col.colSpan == 3 ? 'col-span-3' : '',
                  col.colSpan == 4 ? 'col-span-4' : '',
                )}
              >
                {col.selectable && (
                  <Radio
                    checked={selected.includes(item.id)}
                    onClick={() => toggleSelect(item.id)}
                  ></Radio>
                )}
                {col.cellFormat(
                  col.dataIndex == 'status' ? item : item[col.dataIndex],
                )}
              </div>
            ))}
          </div>
        )}
      ></List>
    )
  }

  if (!documents) {
    return <Spin tip="Loading..." size="large" />
  } else {
    return (
      <div>
        <Collapse>
          <Collapse.Panel
            key={'save'}
            header={
              <div className={'flex justify-between'}>
                <div>Save/Update {type} Documents in HelpMe</div>
              </div>
            }
          >
            <div className={'flex flex-col gap-4'}>
              <div className={'grid grid-cols-1 gap-2'}>
                <div className={'grid grid-cols-4 gap-2'}>
                  <Button
                    className={cn(
                      selected.length <= 0
                        ? 'border-gray-400 bg-gray-300 text-white hover:cursor-not-allowed hover:border-gray-400 hover:text-white'
                        : '',
                    )}
                    disabled={selected.length <= 0}
                    onClick={async () => await uploadOrDeleteFiles('Upload')}
                  >
                    Upload Selected ({selected.length})
                  </Button>
                  <Button
                    onClick={async () =>
                      await uploadOrDeleteFiles('Upload', true)
                    }
                  >
                    Upload All
                  </Button>
                  <Button
                    className={cn(
                      selectedEligible.length <= 0
                        ? 'border-gray-400 bg-gray-300 text-white hover:cursor-not-allowed hover:border-gray-400 hover:text-white'
                        : '',
                    )}
                    disabled={selectedEligible.length <= 0}
                    danger={true}
                    onClick={async () => await uploadOrDeleteFiles('Delete')}
                  >
                    Delete Selected ({selected.length})
                  </Button>
                  <Button
                    className={cn(
                      eligibleToDelete.length <= 0
                        ? 'border-gray-400 bg-gray-300 text-white hover:cursor-not-allowed hover:border-gray-400 hover:text-white'
                        : '',
                    )}
                    onClick={async () =>
                      await uploadOrDeleteFiles('Delete', true)
                    }
                    danger={true}
                    disabled={eligibleToDelete.length <= 0}
                  >
                    Delete All ({eligibleToDelete.length})
                  </Button>
                </div>
                <div className={'mt-4 grid grid-cols-2 gap-2'}>
                  <Button onClick={() => setSelected([])}>
                    Reset Selection
                  </Button>
                  <Button
                    onClick={() => setSelected(documents.map((d) => d.id))}
                  >
                    Select All
                  </Button>
                </div>
              </div>
              {renderDocumentList(
                documents.filter((d) => selected.includes(d.id)),
              )}
            </div>
          </Collapse.Panel>
        </Collapse>
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
              onChange={handleInput}
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
