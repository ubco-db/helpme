import {
  ChatbotDocumentQueryResponse,
  ChatbotDocumentResponse,
  DocumentType,
  DocumentTypeColorMap,
  DocumentTypeDisplayMap,
} from '@koh/common'
import {
  Badge,
  Button,
  Checkbox,
  Col,
  Collapse,
  Input,
  message,
  Modal,
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
  InfoCircleFilled,
  PlusOutlined,
} from '@ant-design/icons'
import { SparklesIcon } from 'lucide-react'

export type DocumentChunkRowProps = {
  documentChunk: ChatbotDocumentResponse
  searchTerms: string[]

  onEditChunk: (record: ChatbotDocumentResponse) => void
  onDeleteChunk: (documentId: string) => void

  generateQueries: (documentId: string, deleteOld: boolean) => Promise<boolean>
  onCreateQuery: (documentId: string, content: string) => Promise<boolean>
  onEditQuery: (queryId: string, content: string) => Promise<boolean>
  onDeleteQuery: (queryId: string) => Promise<boolean>

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
}) => {
  const [editingQueries, setEditingQueries] = useState<
    { queryId: string; editingContent: string }[]
  >([])
  const [creatingQuery, setCreatingQuery] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [removeOld, setRemoveOld] = useState(false)

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

  const toggleCreateQuery = () => {
    setCreatingQuery(true)
  }

  const cancelCreateQuery = () => {
    setCreatingQuery(false)
  }

  const submitCreateQuery = (text: string) => {
    if (!text) {
      message.warning('Document query cannot be empty!')
      return
    }
    setIsSaving(true)
    onCreateQuery(documentChunk.id, text)
      .then((success) => {
        if (success) {
          setCreatingQuery(false)
        }
      })
      .finally(() => setIsSaving(false))
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
        <Col span={2} className={gridCell}>
          <Badge
            count={
              DocumentTypeDisplayMap[documentChunk.type] ??
              (DocumentType as any)[documentChunk.type]
            }
            color={DocumentTypeColorMap[documentChunk.type] ?? '#7C7C7C'}
          />
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
                  <Tooltip
                    title={
                      "Document queries are used to improve the retrieval algorithm when students ask questions in your course. These are synthetic (by default) questions, paired with the document chunk, that are checked for similarity with the student's own question."
                    }
                  >
                    Document Queries <InfoCircleFilled />
                  </Tooltip>
                ),
                children: (
                  <>
                    <Row className={'justify-end text-gray-500'}>
                      <div className={'flex items-center justify-center gap-2'}>
                        <Button
                          color={'purple'}
                          variant={'solid'}
                          icon={<SparklesIcon size={16} />}
                          loading={isSaving}
                          onClick={() => {
                            setIsSaving(true)
                            generateQueries(
                              documentChunk.id,
                              removeOld,
                            ).finally(() => setIsSaving(false))
                          }}
                        >
                          Generate Document Queries
                        </Button>
                        <Checkbox
                          onClick={() => setRemoveOld(!removeOld)}
                          checked={removeOld}
                        >
                          Remove Existing?
                        </Checkbox>
                      </div>
                    </Row>
                    <Row className={'text-gray-500'}>
                      <Col span={21} className="p-2">
                        Query Content
                      </Col>
                      <Col span={3} className="p-2">
                        Actions
                      </Col>
                    </Row>
                    {documentChunk.queries.map((q, i) => (
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
                        isAddRow={false}
                        isAdding={false}
                      />
                    ))}
                    <DocumentQueryRow
                      query={{ id: '', query: '' } as any}
                      isAddRow={true}
                      isAdding={creatingQuery}
                      cancelEdit={cancelCreateQuery}
                      editingQueries={[]}
                      isSaving={isSaving}
                      onDelete={() => undefined}
                      onEdit={toggleCreateQuery}
                      onTextInput={() => undefined}
                      submitEdit={submitCreateQuery}
                    />
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
  isAddRow: boolean
  isAdding: boolean
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
  isAddRow,
  isAdding,
}) => {
  const [input, setInput] = useState<string>()
  const editingRow = useMemo(
    () => editingQueries.find((eq) => eq.queryId == query.id),
    [query, editingQueries],
  )

  useEffect(() => {
    if (!isAdding) {
      setInput(undefined)
    }
  }, [isAdding])

  return (
    <Row>
      <Col span={21} className="p-2">
        <div className={'flex items-center justify-center'}>
          {editingRow || (isAddRow && isAdding) ? (
            <Input
              type={'text'}
              onChange={(event) => {
                const val = event?.currentTarget?.value ?? ''
                isAddRow ? setInput(val) : onTextInput(query.id, val)
              }}
            />
          ) : isAddRow ? (
            <span></span>
          ) : (
            <span>query.query</span>
          )}
        </div>
      </Col>
      <Col span={3} className="p-2">
        <div className={'flex flex-col gap-1'}>
          {editingRow || (isAddRow && isAdding) ? (
            <>
              <Button
                onClick={() => submitEdit(isAddRow ? (input ?? '') : query.id)}
                variant={'outlined'}
                color={'blue'}
                icon={<CheckOutlined />}
                loading={isSaving}
              >
                {isAddRow ? 'Submit' : 'Save Changes'}
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
                icon={isAddRow ? <PlusOutlined /> : <EditOutlined />}
                loading={isSaving}
              >
                {isAddRow ? 'Create' : 'Edit'}
              </Button>
              {!isAddRow && (
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
              )}
            </>
          )}
        </div>
      </Col>
    </Row>
  )
}

export default DocumentChunkRow
