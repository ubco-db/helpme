'use client'

import {
  ReactElement,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Button, Empty, Input, message, Pagination } from 'antd'
import Link from 'next/link'
import { getErrorMessage } from '@/app/utils/generalUtils'
import {
  ChatbotDocumentQueryResponse,
  ChatbotDocumentResponse,
  ChatbotResultEventName,
  ChatbotResultEvents,
  CreateDocumentChunkBody,
  UpdateDocumentChunkBody,
} from '@koh/common'
import { API } from '@/app/api'
import ChatbotHelpTooltip from '../components/ChatbotHelpTooltip'
import UpsertDocumentChunkModal from './components/UpsertDocumentChunkModal'
import { getPaginatedChatbotDocuments } from '@/app/(dashboard)/course/[cid]/(settings)/settings/util'
import DocumentChunkRow from '@/app/(dashboard)/course/[cid]/(settings)/settings/chatbot_knowledge_base/components/DocumentChunkRow'
import { useWebSocket } from '@/app/contexts/WebSocketContext'

interface ChatbotDocumentsProps {
  params: Promise<{ cid: string }>
}

type BaseSocketExpected = {
  params: { resultId: string; type: ChatbotResultEventName }
}

type DocumentReturn = {
  data: ChatbotDocumentResponse[] | Error
} & BaseSocketExpected
type QueriesReturn = {
  data: ChatbotDocumentQueryResponse[] | Error
} & BaseSocketExpected

export default function ChatbotDocuments(
  props: ChatbotDocumentsProps,
): ReactElement {
  const webSocket = useWebSocket()

  const params = use(props.params)
  const courseId = Number(params.cid)

  const [documents, setDocuments] = useState<ChatbotDocumentResponse[]>([])
  const [total, setTotal] = useState<number>(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const searchTerms = useMemo(() => search?.split(/\s/) ?? [], [search])

  const [pendingQueryResults, setPendingQueryResults] = useState<
    { resultId: string; documentId: string; deleteOld: boolean }[]
  >([])
  const [pendingUpdateResults, setPendingUpdateResults] = useState<
    { resultId: string; documentId: string }[]
  >([])

  const [editingChunk, setEditingChunk] = useState<ChatbotDocumentResponse>()
  const [operatingOn, setOperatingOn] = useState<string[]>([])
  const [upsertModalOpen, setUpsertModalOpen] = useState(false)

  const documentQueriesListener = useCallback(
    async (data: QueriesReturn) => {
      if ('params' in data && 'resultId' in data.params) {
        const { resultId } = data.params
        const response = data.data

        const match = pendingQueryResults.find((v) => v.resultId === resultId)
        if (!match) {
          return
        }

        if ('error' in response) {
          // an error occurred and was transmitted down
          message.error(
            `Failed to generate document queries for document ${match.documentId}: ${response}`,
          )
        } else {
          // success
          const matchDoc = documents.find((d) => d.id === match.documentId)
          setDocuments((prev) =>
            prev.map((d) => {
              if (d.id === match.documentId) {
                const entry = {
                  ...d,
                  queries: match.deleteOld
                    ? (response as any)
                    : [...d.queries, ...(response as any)],
                }
                console.log(entry, d)
                return entry
              }
              return d
            }),
          )
          message.success(
            `Successfully generated document queries for document${matchDoc ? ' ' + matchDoc.title + '.' : '.'}`,
          )
        }
        setPendingQueryResults((prev) =>
          prev.filter((v) => v.resultId !== resultId),
        )
      }
    },
    [documents, pendingQueryResults],
  )

  const chunkListener = useCallback(
    async (data: DocumentReturn, isEdit: boolean) => {
      if ('params' in data && 'resultId' in data.params) {
        const { resultId } = data.params
        const response = data.data

        const match = pendingUpdateResults.find((v) => v.resultId === resultId)
        if (!match && isEdit) {
          return
        }
        const doc = documents.find((d) => d.id === match?.documentId)

        if ('error' in response) {
          // an error occurred and was transmitted down
          message.error(
            `Failed to ${isEdit ? 'update' : 'create'} document${doc ? ' ' + doc.title : ''}: ${response}`,
          )
        } else {
          // success
          const docs = response as ChatbotDocumentResponse[]
          if (isEdit) {
            message.success(
              `Document${doc ? ' ' + doc.title : ''} updated successfully.`,
            )
            if (docs.length > 1) {
              message.info(
                `The text content was too large and it was split into ${docs.length} new document chunks.`,
                6,
              )
            }
            setEditingChunk(undefined)
          } else {
            message.success(
              `Document${docs.length > 1 ? 's' : ''} added successfully.`,
            )
            if (docs.length > 1) {
              message.info(
                `Document was too large to fit into one chunk. It was split into ${docs.length} document chunks.`,
                6,
              )
            }
          }
          setUpsertModalOpen(false)
          await getPaginatedChatbotDocuments(
            API.chatbot.staffOnly.getAllDocumentChunks,
            courseId,
            page,
            pageSize,
            setTotal,
            setDocuments,
            search,
          )
        }
        setPendingUpdateResults((prev) =>
          prev.filter((v) => v.resultId !== resultId),
        )
      }
    },
    [documents, pendingUpdateResults, courseId, page, pageSize],
  )

  const listener = useCallback(
    async (data: BaseSocketExpected) => {
      if (!('type' in data.params)) {
        return
      }
      switch (data.params.type) {
        case ChatbotResultEventName.ADD_CHUNK:
          return await chunkListener(data as DocumentReturn, false)
        case ChatbotResultEventName.UPDATE_CHUNK:
          return await chunkListener(data as DocumentReturn, true)
        case ChatbotResultEventName.DOCUMENT_QUERIES:
          return await documentQueriesListener(data as QueriesReturn)
      }
    },
    [chunkListener, documentQueriesListener],
  )

  useEffect(() => {
    if (webSocket) {
      webSocket.onMessageEvent.on(ChatbotResultEvents.POST_RESULT, listener)
      return () => {
        webSocket.onMessageEvent.off(ChatbotResultEvents.POST_RESULT, listener)
      }
    }
  }, [listener, webSocket])

  const addDocument = async (values: CreateDocumentChunkBody) => {
    await API.chatbot.staffOnly
      .addDocumentChunk(courseId, values)
      .then(async (resultId: string) => {
        const res = await webSocket.subscribe(ChatbotResultEvents.GET_RESULT, {
          type: ChatbotResultEventName.ADD_CHUNK,
          resultId,
        })
        if (!res.success) {
          message.success(
            'Document creation successfully queued, but subscription to results failed.',
          )
          return
        }
        message.success('Document creation successfully queued!')
      })
      .catch((e) => {
        const errorMessage = getErrorMessage(e)
        message.error('Failed to add document: ' + errorMessage)
      })
  }

  const updateDocument = async (
    id: string,
    values: UpdateDocumentChunkBody,
  ) => {
    const original = documents.find((v) => v.id == id)
    if (!original) {
      message.error('Could not update document chunk, original was not found.')
      return
    }
    // Strip out identical properties
    Object.entries(original).forEach(([k, v]) => {
      if (k in values && (values as any)[k] === v) {
        ;(values as any)[k] = undefined
      }
    })
    await API.chatbot.staffOnly
      .updateDocumentChunk(courseId, id, values)
      .then(async (resultId: string) => {
        const res = await webSocket.subscribe(ChatbotResultEvents.GET_RESULT, {
          type: ChatbotResultEventName.UPDATE_CHUNK,
          resultId,
        })
        if (!res.success) {
          message.success(
            'Document update successfully queued, but subscription to results failed.',
          )
          return
        }
        message.success('Document update successfully queued!')
        setPendingUpdateResults((prev) => [
          ...prev,
          { resultId, documentId: id },
        ])
      })
      .catch((e) => {
        const errorMessage = getErrorMessage(e)
        message.error('Failed to add document: ' + errorMessage)
      })
  }

  useEffect(() => {
    if (courseId) {
      getPaginatedChatbotDocuments(
        API.chatbot.staffOnly.getAllDocumentChunks,
        courseId,
        page,
        pageSize,
        setTotal,
        setDocuments,
        search,
      )
    }
  }, [courseId, page, pageSize])

  const generateDocumentQueries = async (
    documentId: string,
    deleteOld: boolean,
  ) => {
    if (pendingQueryResults.some((q) => q.documentId === documentId)) {
      message.warning('Already generating queries for this document!')
      return
    }
    await API.chatbot.staffOnly
      .generateDocumentQueries(courseId, documentId, { deleteOld })
      .then(async (resultId: string) => {
        const res = await webSocket.subscribe(ChatbotResultEvents.GET_RESULT, {
          type: ChatbotResultEventName.DOCUMENT_QUERIES,
          resultId,
        })
        if (!res.success) {
          message.success(
            'Document query generation successfully queued, but subscription to results failed.',
          )
          return
        }
        setPendingQueryResults((prev) => [
          ...prev,
          { documentId, resultId, deleteOld },
        ])
        message.success('Document query generation successfully queued.')
      })
      .catch((e) => {
        const errorMessage = getErrorMessage(e)
        message.error('Failed to generate document queries: ' + errorMessage)
      })
  }

  const createDocumentQuery = async (documentId: string, content: string) => {
    return await API.chatbot.staffOnly
      .addDocumentQuery(courseId, documentId, { query: content })
      .then((queryResponse: ChatbotDocumentQueryResponse) => {
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === documentId
              ? { ...d, queries: [...d.queries, queryResponse] }
              : d,
          ),
        )
        const doc = documents.find((d) => d.id == documentId)
        if (doc) {
          doc.queries.push(queryResponse)
        }
        message.success('Document query created successfully.')
        return true
      })
      .catch((e) => {
        const errorMessage = getErrorMessage(e)
        message.error('Failed to create document query: ' + errorMessage)
        return false
      })
  }

  const editDocument = async (documentChunk: ChatbotDocumentResponse) => {
    setEditingChunk(documentChunk)
    setUpsertModalOpen(true)
  }

  const editDocumentQuery = async (queryId: string, content: string) => {
    return await API.chatbot.staffOnly
      .updateDocumentQuery(courseId, queryId, { query: content })
      .then((queryResponse: ChatbotDocumentQueryResponse) => {
        setDocuments((prev) =>
          prev.map((d) => ({
            ...d,
            queries: d.queries.map((q) =>
              q.id === queryId ? queryResponse : q,
            ),
          })),
        )
        message.success('Document query updated successfully.')
        return true
      })
      .catch((e) => {
        const errorMessage = getErrorMessage(e)
        message.error('Failed to update document query: ' + errorMessage)
        return false
      })
  }

  const deleteDocument = async (documentId: string) => {
    setOperatingOn((prev) => [...prev, documentId])
    await API.chatbot.staffOnly
      .deleteDocumentChunk(courseId, documentId)
      .then(() => {
        getPaginatedChatbotDocuments(
          API.chatbot.staffOnly.getAllDocumentChunks,
          courseId,
          page,
          pageSize,
          setTotal,
          setDocuments,
          search,
        )
        message.success('Document deleted successfully.')
      })
      .catch((e) => {
        const errorMessage = getErrorMessage(e)
        message.error('Failed to delete document: ' + errorMessage)
      })
      .finally(() =>
        setOperatingOn((prev) => prev.filter((d) => d != documentId)),
      )
  }

  const deleteDocumentQuery = async (queryId: string) => {
    await API.chatbot.staffOnly
      .deleteDocumentQuery(courseId, queryId)
      .then(() => {
        setDocuments((prev) =>
          prev.map((d) => ({
            ...d,
            queries: d.queries.filter((q) => q.id !== queryId),
          })),
        )
        message.success('Document query deleted successfully.')
      })
      .catch((e) => {
        const errorMessage = getErrorMessage(e)
        message.error('Failed to delete document query: ' + errorMessage)
      })
  }

  const deleteAllDocumentQueries = async (documentId: string) => {
    await API.chatbot.staffOnly
      .deleteAllDocumentQueries(courseId, documentId)
      .then(() => {
        setDocuments((prev) =>
          prev.map((d) => (d.id === documentId ? { ...d, queries: [] } : d)),
        )
        message.success('Document queries deleted successfully.')
      })
      .catch((e) => {
        const errorMessage = getErrorMessage(e)
        message.error('Failed to delete document queries: ' + errorMessage)
      })
  }

  return (
    <div className="m-auto my-5">
      {upsertModalOpen && (
        <UpsertDocumentChunkModal
          open={upsertModalOpen}
          editingChunk={editingChunk}
          addDocument={addDocument}
          updateDocument={updateDocument}
          onCancel={() => {
            setEditingChunk(undefined)
            setUpsertModalOpen(false)
          }}
        />
      )}
      <div className="flex w-full items-center justify-between">
        <div>
          <h3 className="m-0 p-0 text-4xl font-bold text-gray-900">
            View Chatbot Document Chunks
          </h3>
          <p className="text-[16px] font-medium text-gray-600">
            These chunks are what the chatbot uses to answer questions.
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 md:flex-row">
          <ChatbotHelpTooltip forPage="chatbot_knowledge_base" />
          <Button
            type={'primary'}
            onClick={() => {
              setEditingChunk(undefined)
              setUpsertModalOpen(true)
            }}
          >
            Add New Chunk
          </Button>
        </div>
      </div>
      <hr className="my-5 w-full"></hr>
      <div className={'flex justify-between gap-2'}>
        <Input
          placeholder={'Search chunk name or content and press enter...'}
          value={search}
          onChange={(e) => {
            e.preventDefault()
            setSearch(e.target.value)
          }}
          onPressEnter={() => {
            setPage(1)
            getPaginatedChatbotDocuments(
              API.chatbot.staffOnly.getAllDocumentChunks,
              courseId,
              page,
              pageSize,
              setTotal,
              setDocuments,
              search,
            )
          }}
        />
        <div className={'flex min-w-[25%] justify-end'}>
          <Pagination
            total={total}
            showSizeChanger={false}
            current={page}
            pageSize={pageSize}
            size={'small'}
            onChange={(page, pageSize) => {
              setPage(page)
              setPageSize(pageSize)
            }}
          />
        </div>
      </div>
      {documents.length <= 0 ? (
        <Empty
          description={
            <div>
              No chunks added yet. <br /> Head to{' '}
              <Link href={`/course/${courseId}/settings/chatbot_settings`}>
                Chatbot Settings
              </Link>{' '}
              and add some course documents so your chatbot can start citing
              things!
            </div>
          }
        />
      ) : (
        <>
          {documents.map((d, i) => (
            <DocumentChunkRow
              key={'document' + i}
              documentChunk={d}
              isLoading={!!operatingOn?.includes(d.id)}
              onCreateQuery={createDocumentQuery}
              onDeleteChunk={deleteDocument}
              onDeleteQuery={deleteDocumentQuery}
              onEditChunk={editDocument}
              onEditQuery={editDocumentQuery}
              generateQueries={generateDocumentQueries}
              onDeleteAllQueries={deleteAllDocumentQueries}
              searchTerms={searchTerms}
            />
          ))}
        </>
      )}
    </div>
  )
}
