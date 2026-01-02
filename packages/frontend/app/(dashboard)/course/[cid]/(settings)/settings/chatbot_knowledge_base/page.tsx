'use client'

import { ReactElement, use, useEffect, useState } from 'react'
import {
  Badge,
  Button,
  Empty,
  Input,
  message,
  Modal,
  Pagination,
  Table,
} from 'antd'
import Link from 'next/link'
import { getErrorMessage } from '@/app/utils/generalUtils'
import Highlighter from 'react-highlight-words'
import ExpandableText from '@/app/components/ExpandableText'
import {
  ChatbotDocumentResponse,
  CreateDocumentChunkBody,
  DocumentType,
  DocumentTypeColorMap,
  DocumentTypeDisplayMap,
  UpdateDocumentChunkBody,
} from '@koh/common'
import { API } from '@/app/api'
import ChatbotHelpTooltip from '../components/ChatbotHelpTooltip'
import UpsertDocumentChunkModal from './components/UpsertDocumentChunkModal'
import { getPaginatedChatbotDocuments } from '@/app/(dashboard)/course/[cid]/(settings)/settings/util'
import { DeleteOutlined, EditOutlined } from '@ant-design/icons'

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

  const [editingChunk, setEditingChunk] = useState<ChatbotDocumentResponse>()
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

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: 300,
      render: (text: string, record: ChatbotDocumentResponse) => (
        <ExpandableText maxRows={4}>
          <Link
            href={record.source ?? ''}
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
              searchWords={[search]}
              autoEscape
              textToHighlight={text ? text.toString() : ''}
            />
          </Link>
        </ExpandableText>
      ),
    },
    {
      title: 'Chunk Content',
      dataIndex: 'content',
      key: 'content',
      render: (text: string) => (
        <ExpandableText maxRows={4}>
          {/*
              In some environments, components which return Promises or arrays do not work.
              This is due to some changes to react and @types/react, and the component
              packages have not been updated to fix these issues.
            */}
          {/* @ts-expect-error Server Component */}
          <Highlighter
            highlightStyle={{ backgroundColor: '#ffc069', padding: 0 }}
            searchWords={[search]}
            autoEscape
            textToHighlight={text ? text.toString() : ''}
          />
        </ExpandableText>
      ),
    },
    {
      title: 'Page #',
      dataIndex: 'pageNumber',
      key: 'pageNumber',
      width: '5%',
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: '10%',
      render: (type: DocumentType) => (
        <Badge
          count={DocumentTypeDisplayMap[type] ?? (DocumentType as any)[type]}
          color={DocumentTypeColorMap[type] ?? '#7C7C7C'}
        />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: any, record: ChatbotDocumentResponse) => (
        <div className={'flex flex-col gap-1'}>
          <Button
            onClick={() => {
              setEditingChunk(record)
              setUpsertModalOpen(true)
            }}
            variant={'outlined'}
            color={'blue'}
            icon={<EditOutlined />}
          >
            Edit
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: 'Are you sure you want to delete this document chunk?',
                content:
                  'Note that this will cascade to any citations which reference this chunk, and remove it from any parent question or documents. \n\nThis action cannot be undone.',
                okText: 'Yes',
                okType: 'danger',
                cancelText: 'No',
                onOk() {
                  if (!record.id) {
                    return
                  }
                  deleteDocument(record.id)
                },
              })
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ]

  const deleteDocument = async (documentId: string) => {
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
      <Table
        columns={columns}
        dataSource={documents}
        size="small"
        className="w-full"
        pagination={false}
        locale={{
          emptyText: (
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
          ),
        }}
      />
    </div>
  )
}
