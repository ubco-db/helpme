import {
  ChatbotDocumentQueryResponse,
  ChatbotDocumentResponse,
  DocumentType,
  DocumentTypeColorMap,
  DocumentTypeDisplayMap,
} from '@koh/common'
import {
  Button,
  Checkbox,
  Col,
  Collapse,
  Divider,
  Input,
  message,
  Modal,
  Pagination,
  Row,
  Tooltip,
} from 'antd'
import ExpandableText from '@/app/components/ExpandableText'
import Link from 'next/link'
import Highlighter from 'react-highlight-words'
import { useEffect, useMemo, useState } from 'react'
import {
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { SparklesIcon } from 'lucide-react'
import { cn } from '@/app/utils/generalUtils'

export type DocumentChunkRowProps = {
  documentChunk: ChatbotDocumentResponse
  searchTerms: string[]

  onEditChunk: (record: ChatbotDocumentResponse) => void
  onDeleteChunk: (documentId: string) => void

  generateQueries: (documentId: string, deleteOld: boolean) => Promise<void>
  onCreateQuery: (documentId: string, content: string) => Promise<boolean>
  onEditQuery: (queryId: string, content: string) => Promise<boolean>
  onDeleteQuery: (queryId: string) => Promise<void>
  onDeleteAllQueries: (documentId: string) => Promise<void>

  isLoading: boolean
}

const DocumentChunkRow: React.FC<DocumentChunkRowProps> = ({
  documentChunk,
  searchTerms,

  onEditChunk,
  onDeleteChunk,

  generateQueries,
  onCreateQuery,
  onEditQuery,
  onDeleteQuery,
  onDeleteAllQueries,
}) => {
  const [editingQueries, setEditingQueries] = useState<
    { queryId: string; editingContent: string }[]
  >([])
  const [creatingInput, setCreatingInput] = useState<string | undefined>()
  const [creatingQuery, setCreatingQuery] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [removeOld, setRemoveOld] = useState(false)
  const [generateConfirmModalOpen, setGenerateConfirmModalOpen] =
    useState(false)

  const [page, setPage] = useState(1)

  useEffect(() => {
    const ids = documentChunk.queries.map((q) => q.id)
    setEditingQueries((prev) => prev.filter((eq) => ids.includes(eq.queryId)))
  }, [documentChunk.queries])

  const toggleEditQuery = (record: ChatbotDocumentQueryResponse) => {
    if (editingQueries.find((eq) => eq.queryId == record.id)) return
    setEditingQueries((prev) => [
      ...prev,
      {
        queryId: record.id,
        editingContent: record.query,
      },
    ])
  }

  const onEditQueryInput = (queryId: string, text: string) => {
    const index = editingQueries.findIndex((eq) => eq.queryId == queryId)
    if (index < 0) {
      message.warning('Edited query not found!')
      return
    }

    setEditingQueries((prev) => {
      prev[index] = {
        queryId,
        editingContent: text,
      }
      return prev
    })
  }

  const cancelEditQuery = (record: ChatbotDocumentQueryResponse) => {
    setEditingQueries((prev) => prev.filter((p) => p.queryId != record.id))
  }

  const submitEditQuery = (queryId: string) => {
    const entry = editingQueries.find((eq) => eq.queryId == queryId)
    if (!entry) {
      message.warning('Edited query not found!')
      return
    }

    setIsSaving(true)
    onEditQuery(queryId, entry.editingContent)
      .then((success) => {
        if (success) {
          setEditingQueries((prev) => prev.filter((p) => p.queryId != queryId))
        }
      })
      .finally(() => setIsSaving(false))
  }

  const submitDeleteQuery = (queryId: string) => {
    setIsSaving(true)
    onDeleteQuery(queryId).finally(() => setIsSaving(false))
  }

  const gridCell = 'p-2 flex items-center justify-center'

  return (
    <div
      className={
        'my-2 grid w-full grid-cols-1 rounded-md border-2 border-gray-300 bg-white p-2'
      }
    >
      <Row wrap={false} className={'text-gray-500'}>
        <Col span={6} className={gridCell}>
          Title
        </Col>
        <Col span={13} className={gridCell}>
          <span className={'w-full'}>Content</span>
        </Col>
        <Col span={1} className={gridCell}>
          <span>{documentChunk.pageNumber ? 'Page Number' : ' '}</span>
        </Col>
        <Col span={2} className={gridCell}>
          Type
        </Col>
        <Col span={2} className={gridCell}>
          Actions
        </Col>
      </Row>
      <Row wrap={false}>
        <Col span={6} className={gridCell}>
          <ExpandableText maxRows={4}>
            <Link
              href={documentChunk.source ?? ''}
              target="_blank"
              prefetch={false}
              rel="noopener noreferrer"
            >
              {/*
              In some environments, components which return Promises or arrays do not work.
              This is due to some changes to react and @types/react, and the component
              packages have not been updated to fix these issues.
            */}
              {/* @ts-expect-error Server Component */}
              <Highlighter
                highlightStyle={{ backgroundColor: '#ffc069', padding: 0 }}
                searchWords={searchTerms}
                autoEscape
                textToHighlight={
                  documentChunk.title ? documentChunk.title.toString() : ''
                }
              />
            </Link>
          </ExpandableText>
        </Col>
        <Col span={13} className={gridCell}>
          {/*
              In some environments, components which return Promises or arrays do not work.
              This is due to some changes to react and @types/react, and the component
              packages have not been updated to fix these issues.
            */}
          {/* @ts-expect-error Server Component */}
          <Highlighter
            highlightStyle={{ backgroundColor: '#ffc069', padding: 0 }}
            searchWords={searchTerms}
            autoEscape
            textToHighlight={
              documentChunk.content ? documentChunk.content.toString() : ''
            }
          />
        </Col>
        <Col span={1} className={gridCell}>
          <span>{documentChunk.pageNumber ?? ''}</span>
        </Col>
        <Col span={2} className={cn(gridCell, 'p-3')}>
          <div
            className={cn(
              'mx-1 flex h-fit items-center justify-center gap-1 rounded-lg px-1 py-0.5 text-center text-xs text-white',
            )}
            style={{
              backgroundColor:
                DocumentTypeColorMap[documentChunk.type] ?? '#7c7c7c',
            }}
          >
            {DocumentTypeDisplayMap[documentChunk.type] ??
              (DocumentType as any)[documentChunk.type]}
          </div>
        </Col>
        <Col span={2} className={gridCell}>
          <div className={'flex flex-col gap-1'}>
            <Button
              onClick={() => onEditChunk(documentChunk)}
              variant={'outlined'}
              color={'blue'}
              icon={<EditOutlined />}
            >
              Edit
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() =>
                Modal.confirm({
                  title: 'Are you sure you want to delete this document chunk?',
                  content:
                    'Note that this will cascade to any citations which reference this chunk, and remove it from any parent question or documents. \n\nThis action cannot be undone.',
                  okText: 'Yes',
                  okType: 'danger',
                  cancelText: 'No',
                  onOk() {
                    if (!documentChunk.id) {
                      return
                    }
                    onDeleteChunk(documentChunk.id)
                  },
                })
              }
            >
              Delete
            </Button>
          </div>
        </Col>
      </Row>
      <Modal
        title={'Create New Document Query'}
        open={creatingQuery}
        onCancel={() => setCreatingQuery(false)}
        okButtonProps={{
          loading: isSaving,
        }}
        onOk={() => {
          if (!documentChunk.id) {
            setCreatingQuery(false)
            return
          }
          if (!creatingInput) {
            message.warning('Cannot create an empty query!')
            return
          }
          setIsSaving(true)
          onCreateQuery(documentChunk.id, creatingInput)
            .then(() => {
              setCreatingQuery(false)
              setCreatingInput(undefined)
            })
            .finally(() => setIsSaving(false))
        }}
        okText={'Create'}
      >
        <div className={'flex flex-col gap-2'}>
          <p>
            Document queries are used to improve the retrieval stage of the RAG
            algorithm, by closer matching to the potential questions asked by
            users.
          </p>
          <Input
            placeholder={'A question about this document chunk?'}
            value={creatingInput}
            onInput={(evt) => setCreatingInput(evt.currentTarget?.value)}
          />
        </div>
      </Modal>
      <Modal
        title={'Generate Queries'}
        open={generateConfirmModalOpen}
        onCancel={() => setGenerateConfirmModalOpen(false)}
        footer={
          <div className={'flex justify-end gap-2'}>
            <Button onClick={() => setGenerateConfirmModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={'solid'}
              color={'purple'}
              onClick={() => {
                setGenerateConfirmModalOpen(false)
                if (!documentChunk.id) {
                  return
                }
                setIsSaving(true)
                generateQueries(documentChunk.id, removeOld).finally(() =>
                  setIsSaving(false),
                )
              }}
            >
              Generate Queries
            </Button>
          </div>
        }
      >
        <div className={'flex flex-col justify-start gap-1'}>
          <p>
            This will generate a series of document queries that will match this
            chunk, based on it and its surrounding chunks in the document.
          </p>
          <p>
            Document queries are used to improve the retrieval stage of the RAG
            algorithm, by closer matching to the potential questions asked by
            users.
          </p>
          <p>You have the option to remove previously generated queries:</p>
          <Checkbox
            className={'self-center'}
            onClick={() => setRemoveOld(!removeOld)}
            checked={removeOld}
          >
            Remove Existing Queries
          </Checkbox>
          {removeOld && (
            <span className={'flex gap-2 self-center text-yellow-300'}>
              <WarningOutlined />
              <span className={'text-yellow-500'}>
                {documentChunk.queries.length} queries will be removed
              </span>
            </span>
          )}
        </div>
      </Modal>
      {!documentChunk.questionId && !documentChunk.asyncQuestionId && (
        <Row wrap={false}>
          <Collapse
            bordered={false}
            className={'w-full'}
            destroyOnHidden={true}
            items={[
              {
                key: 'document_queries',
                label: (
                  <div className={'flex justify-between'}>
                    <div>
                      <Tooltip
                        title={
                          "Document queries are used to improve the retrieval algorithm when students ask questions in your course. These are synthetic (by default) questions, paired with the document chunk, that are checked for similarity with the student's own question."
                        }
                      >
                        Document Queries{' '}
                        {(documentChunk.queries?.length ?? []) > 0
                          ? `(${documentChunk.queries.length})`
                          : ''}{' '}
                        <InfoCircleOutlined />
                      </Tooltip>
                    </div>
                    <div className={'flex flex-row gap-2'}>
                      <Button
                        color={'purple'}
                        variant={'solid'}
                        icon={<SparklesIcon size={16} />}
                        loading={isSaving}
                        onClick={(evt) => {
                          evt.stopPropagation()
                          setGenerateConfirmModalOpen(true)
                        }}
                      >
                        Generate
                      </Button>
                      <Button
                        color={'primary'}
                        variant={'solid'}
                        icon={<PlusOutlined size={16} />}
                        loading={isSaving}
                        onClick={(evt) => {
                          evt.stopPropagation()
                          setCreatingQuery(true)
                        }}
                      >
                        Create
                      </Button>
                      <Button
                        danger={true}
                        color={'red'}
                        variant={'solid'}
                        icon={<DeleteOutlined />}
                        onClick={(evt) => {
                          evt.stopPropagation()
                          Modal.confirm({
                            title:
                              'Are you sure you want to delete all document queries for this chunk?',
                            content: `${documentChunk.queries.length} queries will be deleted.\n\nThis action cannot be undone.`,
                            okText: 'Yes',
                            okType: 'danger',
                            cancelText: 'No',
                            onOk() {
                              if (!documentChunk.id) {
                                return
                              }
                              setIsSaving(true)
                              onDeleteAllQueries(documentChunk.id).finally(() =>
                                setIsSaving(false),
                              )
                            },
                          })
                        }}
                      >
                        Delete All
                      </Button>
                    </div>
                  </div>
                ),
                children: (
                  <>
                    <Row className={'flex justify-end'}>
                      <Pagination
                        style={{ float: 'right' }}
                        total={documentChunk.queries.length}
                        showSizeChanger={false}
                        current={page}
                        pageSize={10}
                        onChange={(page) => {
                          setPage(page)
                        }}
                      />
                    </Row>
                    <Row className={'text-gray-500'}>
                      <Col span={21} className="p-2">
                        Query Content
                      </Col>
                      <Col span={3} className="p-2">
                        Actions
                      </Col>
                    </Row>
                    {documentChunk.queries
                      .slice((page - 1) * 10, page * 10)
                      .map((q, i) => (
                        <DocumentQueryRow
                          key={'query' + i}
                          query={q}
                          onEdit={toggleEditQuery}
                          onDelete={submitDeleteQuery}
                          onTextInput={onEditQueryInput}
                          submitEdit={submitEditQuery}
                          cancelEdit={cancelEditQuery}
                          editingQueries={editingQueries}
                          isSaving={isSaving}
                        />
                      ))}
                  </>
                ),
              },
            ]}
          />
        </Row>
      )}
    </div>
  )
}

export type DocumentQueryRowProps = {
  query: ChatbotDocumentQueryResponse
  editingQueries: { queryId: string; editingContent: string }[]
  onTextInput: (queryId: string, text: string) => void

  onDelete: (queryId: string) => void
  submitEdit: (queryId: string) => void

  onEdit: (record: ChatbotDocumentQueryResponse) => void
  cancelEdit: (record: ChatbotDocumentQueryResponse) => void

  isSaving: boolean
}
const DocumentQueryRow: React.FC<DocumentQueryRowProps> = ({
  query,
  editingQueries,
  onTextInput,
  onEdit,
  onDelete,
  submitEdit,
  cancelEdit,
  isSaving,
}) => {
  const editingRow = useMemo(
    () => editingQueries.find((eq) => eq.queryId == query.id),
    [query, editingQueries],
  )

  return (
    <Row>
      <Col span={21} className="p-2">
        <div className={'flex items-center justify-center'}>
          {editingRow ? (
            <Input
              type={'text'}
              onChange={(event) => {
                const val = event?.currentTarget?.value ?? ''
                onTextInput(query.id, val)
              }}
            />
          ) : (
            <span className={'flex w-full flex-col justify-center text-left'}>
              {query.query}
            </span>
          )}
        </div>
      </Col>
      <Col span={3} className="p-2">
        <div className={'flex flex-col gap-1'}>
          {editingRow ? (
            <>
              <Button
                onClick={() => submitEdit(query.id)}
                variant={'outlined'}
                color={'blue'}
                icon={<CheckOutlined />}
                loading={isSaving}
              >
                {'Save Changes'}
              </Button>
              <Button
                icon={<CloseOutlined />}
                onClick={() => {
                  cancelEdit(query)
                }}
                loading={isSaving}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={() => onEdit(query)}
                variant={'outlined'}
                color={'blue'}
                icon={<EditOutlined />}
                loading={isSaving}
              >
                {'Edit'}
              </Button>
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={() =>
                  Modal.confirm({
                    title:
                      'Are you sure you want to delete this document query?',
                    content: 'This action cannot be undone.',
                    okText: 'Yes',
                    okType: 'danger',
                    cancelText: 'No',
                    onOk() {
                      if (!query.id) {
                        return
                      }
                      onDelete(query.id)
                    },
                  })
                }
                loading={isSaving}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </Col>
      <Divider />
    </Row>
  )
}

export default DocumentChunkRow
