'use client'

import { Button, Divider, Input, message, Modal, Table } from 'antd'
import { ReactElement, useCallback, useEffect, useState } from 'react'
import ExpandableText from '@/app/components/ExpandableText'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { useUserInfo } from '@/app/contexts/userContext'
import EditChatbotQuestionModal from './components/EditChatbotQuestionModal'
import { DeleteOutlined } from '@ant-design/icons'
import Highlighter from 'react-highlight-words'
import AddChatbotQuestionModal from './components/AddChatbotQuestionModal'

interface Loc {
  pageNumber: number
}

export interface SourceDocument {
  id?: string
  metadata?: {
    loc?: Loc
    name: string
    type?: string
    source?: string
    courseId?: string
  }
  type?: string
  // TODO: is it content or pageContent? since this file uses both. EDIT: It seems to be both/either. Gross.
  content?: string
  pageContent: string
  docName: string
  docId?: string // no idea if this exists in the actual data EDIT: yes it does, sometimes
  pageNumbers?: number[] // same with this, but this might only be for the edit question modal
  pageNumbersString?: string // used only for the edit question modal
  sourceLink?: string
  pageNumber?: number
}

interface IncomingQuestionData {
  id: string
  pageContent: string
  metadata: {
    answer: string
    courseId: string
    verified: boolean
    sourceDocuments: SourceDocument[]
    suggested: boolean
    inserted?: boolean
  }
}

export interface ChatbotQuestion {
  id: string
  question: string
  answer: string
  verified: boolean
  sourceDocuments: SourceDocument[]
  suggested: boolean
  inserted?: boolean
}

type ChatbotQuestionsProps = {
  params: { cid: string }
}

export default function ChatbotQuestions({
  params,
}: ChatbotQuestionsProps): ReactElement {
  const courseId = Number(params.cid)
  const [addModelOpen, setAddModelOpen] = useState(false)
  const { userInfo } = useUserInfo()
  const [search, setSearch] = useState('')
  const [editingRecord, setEditingRecord] = useState<ChatbotQuestion | null>(
    null,
  )
  const [filteredQuestions, setFilteredQuestions] = useState<ChatbotQuestion[]>(
    [],
  )
  const [editRecordModalOpen, setEditRecordModalOpen] = useState(false)
  const [chatQuestions, setChatQuestions] = useState<ChatbotQuestion[]>([])
  const [existingDocuments, setExistingDocuments] = useState([])

  useEffect(() => {
    fetch(`/chat/${courseId}/aggregateDocuments`, {
      headers: { HMS_API_TOKEN: userInfo.chat_token.token },
    })
      .then((res) => res.json())
      .then((json) => {
        // Convert the json to the expected format
        const formattedDocuments = json.map((doc: SourceDocument) => ({
          docId: doc.id,
          docName: doc.pageContent,
          sourceLink: doc.metadata?.source || '', // Handle the optional source field
          pageNumbers: doc.metadata?.loc ? [doc.metadata.loc.pageNumber] : [], // Handle the optional loc field
        }))
        setExistingDocuments(formattedDocuments)
      })
  }, [userInfo.chat_token.token, courseId])

  useEffect(() => {
    const filtered = chatQuestions.filter((q) =>
      q.question.toLowerCase().includes(search.toLowerCase()),
    )
    setFilteredQuestions(filtered)
  }, [search, chatQuestions])

  const columns: any[] = [
    {
      title: 'Question',
      dataIndex: 'question',
      key: 'question',
      sorter: (a: ChatbotQuestion, b: ChatbotQuestion) => {
        const A = a.question || ''
        const B = b.question || ''
        return A.localeCompare(B)
      },
      render: (text: string) => (
        <ExpandableText maxRows={3}>
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
      title: 'Answer',
      dataIndex: 'answer',
      key: 'answer',
      width: 600,
      sorter: (a: ChatbotQuestion, b: ChatbotQuestion) => {
        const A = a.answer || ''
        const B = b.answer || ''
        return A.localeCompare(B)
      },
      render: (text: string) => (
        <ExpandableText maxRows={3}>{text}</ExpandableText>
      ),
    },
    {
      title: 'Source Documents',
      dataIndex: 'sourceDocuments',
      key: 'sourceDocuments',
      render: (sourceDocuments: SourceDocument[]) => {
        return (
          <div className="flex flex-col gap-1">
            {sourceDocuments.map((doc, index) => (
              <div
                className="flex w-fit max-w-[280px] flex-col overflow-hidden rounded-xl bg-slate-100 p-2"
                key={index}
              >
                <div className="truncate font-semibold">
                  {doc.sourceLink ? (
                    <a
                      href={doc.sourceLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {doc.docName}
                    </a>
                  ) : (
                    <span>{doc.docName}</span>
                  )}
                </div>
                <div className="mt-1 flex  gap-1 text-xs">
                  {doc.pageNumber ? (
                    <div
                      key={`${doc.docName}-${doc.pageNumber}`}
                      className="whitespace-nowrap"
                    >
                      p.{doc.pageNumber}
                    </div>
                  ) : (
                    <></>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-1 text-xs">
                  {doc.type ? <></> : <span>{doc.content}</span>}
                </div>
              </div>
            ))}
          </div>
        )
      },
    },
    {
      title: 'Verified',
      dataIndex: 'verified',
      key: 'verified',
      sorter: (a: ChatbotQuestion, b: ChatbotQuestion) => {
        const A = a.verified ? 1 : 0
        const B = b.verified ? 1 : 0
        return B - A
      },
      filters: [
        { text: 'Verified', value: true },
        { text: 'Not Verified', value: false },
      ],
      onFilter: (value: boolean, record: ChatbotQuestion) =>
        record.verified === value,
      render: (verified: boolean) => (
        <span
          className={`rounded px-2 py-1 ${verified ? 'bg-green-100' : 'bg-red-100'}`}
        >
          {verified ? 'Verified' : 'Unverified'}
        </span>
      ),
    },
    {
      title: 'Suggested',
      dataIndex: 'suggested',
      key: 'suggested',
      sorter: (a: ChatbotQuestion, b: ChatbotQuestion) => {
        const A = a.suggested ? 1 : 0
        const B = b.suggested ? 1 : 0
        return B - A
      },
      filters: [
        { text: 'Suggested', value: true },
        { text: 'Not Suggested', value: false },
      ],
      onFilter: (value: boolean, record: ChatbotQuestion) =>
        record.suggested === value,
      render: (suggested: boolean) => (
        <span
          className={`rounded px-2 py-1 ${suggested ? 'bg-green-100' : 'bg-red-100'}`}
        >
          {suggested ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: any, record: ChatbotQuestion) => (
        <div className="flex gap-2">
          <Button onClick={() => showEditModal(record)}>Edit</Button>
          <Button
            icon={<DeleteOutlined />}
            danger
            onClick={() => {
              Modal.confirm({
                title: 'Are you sure you want to delete this question?',
                content: 'This action cannot be undone.',
                okText: 'Yes',
                okType: 'danger',
                cancelText: 'No',
                onOk() {
                  deleteQuestion(record.id)
                },
              })
            }}
          />
        </div>
      ),
    },
  ]

  const showEditModal = (record: ChatbotQuestion) => {
    setEditingRecord(record)
    setEditRecordModalOpen(true)
  }

  const getQuestions = useCallback(async () => {
    try {
      const response = await fetch(`/chat/${courseId}/allQuestions`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          HMS_API_TOKEN: userInfo.chat_token.token,
        },
      })

      if (!response.ok) {
        const errorMessage = getErrorMessage(response)
        throw new Error(errorMessage)
      }
      const data: IncomingQuestionData[] = await response.json() // Assuming the response is an array of questions
      // Parse the data into the expected format
      const parsedQuestions = data.map((question) => ({
        id: question.id,
        question: question.pageContent,
        answer: question.metadata.answer,
        verified: question.metadata.verified,
        sourceDocuments: question.metadata.sourceDocuments,
        suggested: question.metadata.suggested,
        inserted: question.metadata.inserted,
      }))

      setChatQuestions(parsedQuestions)
      setFilteredQuestions(parsedQuestions)
    } catch (e) {
      const errorMessage = getErrorMessage(e)
      message.error('Failed to fetch questions:' + errorMessage)
    }
  }, [courseId, userInfo.chat_token.token])

  useEffect(() => {
    getQuestions()
  }, [editingRecord, getQuestions])

  const deleteQuestion = async (questionId: string) => {
    try {
      await fetch(`/chat/${courseId}/question/${questionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          HMS_API_TOKEN: userInfo.chat_token.token,
        },
      })

      getQuestions()
      message.success('Question successfully deleted')
    } catch (e) {
      message.error('Failed to delete question.')
    }
  }

  return (
    <div className="md:mr-2">
      <AddChatbotQuestionModal
        open={addModelOpen}
        courseId={courseId}
        existingDocuments={existingDocuments}
        onCancel={() => setAddModelOpen(false)}
        onAddSuccess={() => {
          getQuestions()
          setAddModelOpen(false)
        }}
      />
      {editingRecord && (
        <EditChatbotQuestionModal
          open={editRecordModalOpen}
          cid={courseId}
          profile={userInfo}
          editingRecord={editingRecord}
          onCancel={() => setEditRecordModalOpen(false)}
          onSuccessfulUpdate={() => {
            getQuestions()
            setEditRecordModalOpen(false)
          }}
        />
      )}
      <div className="flex w-full items-center justify-between">
        <div className="flex-1">
          <h3 className="m-0 p-0 text-4xl font-bold text-gray-900">
            View Chatbot Questions
          </h3>
          <p className="text-[16px] font-medium text-gray-600">
            View and manage the questions being asked of your chatbot
          </p>
        </div>
        <Input
          className="flex-1"
          placeholder={'Search question...'}
          value={search}
          onChange={(e) => {
            e.preventDefault()
            setSearch(e.target.value)
          }}
          onPressEnter={getQuestions}
        />
        <Button className="m-2" onClick={() => setAddModelOpen(true)}>
          Add Question
        </Button>
      </div>
      <Divider className="my-3" />
      <Table
        columns={columns}
        bordered
        size="small"
        dataSource={filteredQuestions}
      />
    </div>
  )
}
