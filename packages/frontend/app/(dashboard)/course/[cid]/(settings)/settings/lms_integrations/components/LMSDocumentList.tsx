import { SearchOutlined } from '@ant-design/icons'
import { LMSAnnouncement, LMSAssignment, LMSFileResult } from '@koh/common'
import {
  Badge,
  Button,
  Checkbox,
  Collapse,
  Input,
  List,
  message,
  Modal,
  Pagination,
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

  const [isOperating, setIsOperating] = useState<boolean>(false)
  const [currentAction, setCurrentAction] = useState<'Upload' | 'Delete' | ''>(
    '',
  )
  const [currentResults, setCurrentResults] = useState<LMSFileResult[]>([])

  const getStatusCell = useCallback((item: T) => {
    const isOutOfDate =
      item != undefined &&
      item.modified != undefined &&
      item.uploaded != undefined &&
      new Date(item.uploaded).getTime() < new Date(item.modified).getTime()
    const saved = item.uploaded != undefined && (
      <div className={'flex flex-col gap-1'}>
        <div className={'font-semibold'}>Uploaded to HelpMe Chatbot</div>
        <div>Last update: {new Date(item.uploaded).toLocaleDateString()}</div>
      </div>
    )

    return (
      <div className={'flex flex-col gap-2'}>
        {isOutOfDate ? (
          <Badge.Ribbon color={'red'} text={'Out of Date!'}>
            {saved}
          </Badge.Ribbon>
        ) : (
          saved
        )}
        {item.uploaded == undefined && (
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
    ids?: number[],
  ) => {
    setIsOperating(true)
    const text = action == 'Upload' ? 'upload to' : 'delete from'
    const textTo =
      action == 'Upload'
        ? 'uploading LMS documents to'
        : 'deleting LMS documents from'

    if (
      ((ids != undefined && ids.length <= 0) ||
        (ids == undefined && selected.length <= 0)) &&
      !all
    ) {
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
              .uploadAnnouncements(
                courseId,
                all
                  ? documents.map((d) => d.id)
                  : ids != undefined
                    ? ids
                    : selected,
              )
              .then(thenFx)
              .catch(errorFx)
            break
          case 'Delete':
            results = await API.lmsIntegration
              .removeAnnouncements(
                courseId,
                all
                  ? eligibleToDelete.map((d) => d.id)
                  : ids != undefined
                    ? ids
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
              .uploadAssignments(
                courseId,
                all
                  ? documents.map((d) => d.id)
                  : ids != undefined
                    ? ids
                    : selected,
              )
              .then(thenFx)
              .catch(errorFx)
            break
          case 'Delete':
            results = await API.lmsIntegration
              .removeAssignments(
                courseId,
                all
                  ? eligibleToDelete.map((d) => d.id)
                  : ids != undefined
                    ? ids
                    : selectedEligible.map((d) => d.id),
              )
              .then(thenFx)
              .catch(errorFx)
            break
        }
        break
      }
    }

    if (results.length > 0) {
      if (results.filter((r) => !r.success).length == results.length) {
        message.error('Failed to upload any documents to Chatbot')
      } else if (results.filter((r) => r.success).length == results.length) {
        message.success(`${action}ed all documents to Chatbot`)
      } else {
        message.warning('Failed to upload some documents to Chatbot')
      }
    }

    updateCallback()

    setCurrentAction(action)
    setCurrentResults(results)
    setIsOperating(false)
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
                  'flex items-center justify-between border border-gray-100 p-4',
                  col.colSpan == 2 ? 'col-span-2' : '',
                  col.colSpan == 3 ? 'col-span-3' : '',
                  col.colSpan == 4 ? 'col-span-4' : '',
                )}
              >
                {col.selectable && (
                  <Checkbox
                    disabled={
                      ('description' in item &&
                        item.description == undefined) ||
                      (item.description != undefined &&
                        item.description.trim() == '')
                    }
                    checked={selected.includes(item.id)}
                    onClick={() => toggleSelect(item.id)}
                  ></Checkbox>
                )}
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
                    loading={isOperating}
                    disabled={selected.length <= 0}
                    onClick={async () => await uploadOrDeleteFiles('Upload')}
                  >
                    Upload Selected ({selected.length})
                  </Button>
                  <Button
                    loading={isOperating}
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
                    loading={isOperating}
                    disabled={selectedEligible.length <= 0}
                    danger={true}
                    onClick={async () => await uploadOrDeleteFiles('Delete')}
                  >
                    Delete Selected ({selectedEligible.length})
                  </Button>
                  <Button
                    className={cn(
                      eligibleToDelete.length <= 0
                        ? 'border-gray-400 bg-gray-300 text-white hover:cursor-not-allowed hover:border-gray-400 hover:text-white'
                        : '',
                    )}
                    loading={isOperating}
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
                    onClick={() =>
                      setSelected(
                        documents
                          .filter(
                            (item) =>
                              'description' in item &&
                              item.description != undefined &&
                              item.description.trim() != '',
                          )
                          .map((d) => d.id),
                      )
                    }
                  >
                    Select All
                  </Button>
                </div>
              </div>
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
        <Modal
          title={`${type} Document ${currentAction} Result`}
          open={currentAction != '' && currentResults.length > 0}
          okButtonProps={{ className: 'hidden' }}
          cancelText={'Close'}
          onCancel={() => {
            setCurrentAction('')
            setCurrentResults([])
          }}
        >
          <div>
            {currentAction != '' &&
              currentResults.filter((r) => !r.success).length > 0 && (
                <Button
                  className={'my-2 w-full'}
                  loading={isOperating}
                  onClick={() =>
                    uploadOrDeleteFiles(
                      currentAction,
                      false,
                      currentResults.filter((r) => !r.success).map((r) => r.id),
                    )
                  }
                >
                  Retry Failed Operations (
                  {currentResults.filter((r) => !r.success).length})
                </Button>
              )}
            <List
              dataSource={currentResults}
              header={
                <div
                  className={'-mb-3 grid grid-cols-2 bg-gray-100 font-semibold'}
                >
                  <div className={'border border-gray-200 p-2'}>{type} ID</div>
                  <div className={'border border-gray-200 p-2'}>Result</div>
                </div>
              }
              pagination={{
                pageSize: 10,
                position: 'top',
                size: 'small',
                showSizeChanger: false,
              }}
              renderItem={(item: LMSFileResult) => (
                <div className={'grid grid-cols-2'}>
                  <div className={'border border-gray-100 p-2'}>{item.id}</div>
                  <div
                    className={
                      'flex items-center justify-between border border-gray-100 p-2'
                    }
                  >
                    {item.success ? (
                      currentAction == 'Upload' ? (
                        <Badge status={'success'} text={'Uploaded'} />
                      ) : (
                        <Badge status={'success'} text={'Deleted'} />
                      )
                    ) : (
                      <Badge status={'error'} text={'Failure'} />
                    )}
                    {currentAction != '' && !item.success && (
                      <Button
                        loading={isOperating}
                        onClick={() =>
                          uploadOrDeleteFiles(currentAction, false, [item.id])
                        }
                      >
                        Retry
                      </Button>
                    )}
                  </div>
                </div>
              )}
            />
          </div>
        </Modal>
      </div>
    )
  }
}
