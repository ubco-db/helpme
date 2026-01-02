'use client'

import { ReactElement, use, useEffect, useMemo, useState } from 'react'
import { Button, Empty, Input, message, Pagination } from 'antd'
import Link from 'next/link'
import { getErrorMessage } from '@/app/utils/generalUtils'
import {
  ChatbotDocumentQueryResponse,
  ChatbotDocumentResponse,
  CreateDocumentChunkBody,
  UpdateDocumentChunkBody,
} from '@koh/common'
import { API } from '@/app/api'
import ChatbotHelpTooltip from '../components/ChatbotHelpTooltip'
import UpsertDocumentChunkModal from './components/UpsertDocumentChunkModal'
import { getPaginatedChatbotDocuments } from '@/app/(dashboard)/course/[cid]/(settings)/settings/util'
import DocumentChunkRow from '@/app/(dashboard)/course/[cid]/(settings)/settings/chatbot_knowledge_base/components/DocumentChunkRow'

interface ChatbotDocumentsProps {
  params: Promise<{ cid: string }>
}

export default function ChatbotDocuments(
  props: ChatbotDocumentsProps,
): ReactElement {
  const params = use(props.params)
  const courseId = Number(params.cid)

  const [documents, setDocuments] = useState<ChatbotDocumentResponse[]>([])
  const [total, setTotal] = useState<number>(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const searchTerms = useMemo(() => search?.split(/\s/) ?? [], [search])

  const [editingChunk, setEditingChunk] = useState<ChatbotDocumentResponse>()
  const [operatingOn, setOperatingOn] = useState<string[]>([])
  const [upsertModalOpen, setUpsertModalOpen] = useState(false)

  const addDocument = async (values: CreateDocumentChunkBody) => {
    await API.chatbot.staffOnly
      .addDocumentChunk(courseId, values)
      .then((addedDocs) => {
        setUpsertModalOpen(false)
        message.success(
          `Document${addedDocs.length > 1 ? 's' : ''} added successfully.`,
        )
        if (addedDocs.length > 1) {
          message.info(
            `Document was too large to fit into one chunk. It was split into ${addedDocs.length} document chunks.`,
          )
        }
        getPaginatedChatbotDocuments(
          API.chatbot.staffOnly.getAllDocumentChunks,
          courseId,
          page,
          pageSize,
          setTotal,
          setDocuments,
          search,
        )
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
      .then((updatedDocs) => {
        message.success(`Document updated successfully.`)
        if (updatedDocs.length > 1) {
          message.info(
            `The text content was too large and it was split into ${updatedDocs.length} new document chunks.`,
            6,
          )
        }
        setEditingChunk(undefined)
        setUpsertModalOpen(false)
        getPaginatedChatbotDocuments(
          API.chatbot.staffOnly.getAllDocumentChunks,
          courseId,
          page,
          pageSize,
          setTotal,
          setDocuments,
          search,
        )
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
    return await API.chatbot.staffOnly
      .generateDocumentQueries(courseId, documentId, { deleteOld })
      .then((queryResponse: ChatbotDocumentQueryResponse[]) => {
        const doc = documents.find((d) => d.id == documentId)
        if (doc) {
          if (deleteOld) {
            doc.queries = queryResponse
          } else {
            doc.queries = [...doc.queries, ...queryResponse]
          }
        }
        message.success('Document queries generated successfully.')
        return true
      })
      .catch((e) => {
        const errorMessage = getErrorMessage(e)
        message.error('Failed to generate document queries: ' + errorMessage)
        return false
      })
  }

  const createDocumentQuery = async (documentId: string, content: string) => {
    return await API.chatbot.staffOnly
      .addDocumentQuery(courseId, documentId, { query: content })
      .then((queryResponse: ChatbotDocumentQueryResponse) => {
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
        const doc = documents.find((d) =>
          d.queries.some((q) => q.id == queryId),
        )
        if (doc) {
          const idx = doc.queries.findIndex((q) => q.id == queryId)
          if (idx >= 0) {
            doc.queries[idx] = queryResponse
          }
        }
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
    return await API.chatbot.staffOnly
      .deleteDocumentQuery(courseId, queryId)
      .then(() => {
        documents.forEach((d) => d.queries.filter((q) => q.id !== queryId))
        message.success('Document query deleted successfully.')
        return true
      })
      .catch((e) => {
        const errorMessage = getErrorMessage(e)
        message.error('Failed to delete document query: ' + errorMessage)
        return false
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
      <div className={'flex justify-between gap-1'}>
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
        <Pagination
          style={{ float: 'right' }}
          total={total}
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
              searchTerms={searchTerms}
            />
          ))}
        </>
      )}
    </div>
  )
}
