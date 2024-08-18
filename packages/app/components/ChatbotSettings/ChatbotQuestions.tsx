import { Button, Form, Input, Modal, Table } from 'antd'
import React, { ReactElement, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import ExpandableText from '../common/ExpandableText'
import { useProfile } from '../../hooks/useProfile'
import AddQuestionModal from './ChatbotSettingModals/AddQuestionModal'
import EditQuestionModal from './ChatbotSettingModals/EditQuestionModal'

interface Loc {
  pageNumber: number
}

interface SourceDocument {
  id?: string
  metadata?: {
    loc?: Loc
    name: string
    type?: string
    source?: string
    courseId?: string
  }
  type?: string
  content: string
  docName: string
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
  }
}

interface ChatbotQuestion {
  question: string
  answer: string
  verified: boolean
  sourceDocuments: SourceDocument[]
  suggested: boolean
}

type ChatbotQuestionsProps = {
  courseId: number
}

export default function ChatbotQuestions({
  courseId,
}: ChatbotQuestionsProps): ReactElement {
  const [form] = Form.useForm()
  const [addModelOpen, setAddModelOpen] = useState(false)
  const profile = useProfile()
  const [search, setSearch] = useState('')
  const [editingRecord, setEditingRecord] = useState(null)
  const [filteredQuestions, setFilteredQuestions] = useState<ChatbotQuestion[]>(
    [],
  )
  const [editRecordModalVisible, setEditRecordModalVisible] = useState(false)
  const [chatQuestions, setChatQuestions] = useState<ChatbotQuestion[]>([])
  const [existingDocuments, setExistingDocuments] = useState([])

  useEffect(() => {
    if (courseId) {
      fetch(`/chat/${courseId}/aggregateDocuments`, {
        headers: { HMS_API_TOKEN: profile.chat_token.token },
      })
        .then((res) => res.json())
        .then((json) => {
          // Convert the json to the expected format
          const formattedDocuments = json.map((doc) => ({
            docId: doc.id,
            docName: doc.pageContent,
            sourceLink: doc.metadata?.source || '', // Handle the optional source field
            pageNumbers: doc.metadata?.loc ? [doc.metadata.loc.pageNumber] : [], // Handle the optional loc field
          }))
          setExistingDocuments(formattedDocuments)
        })
    }
    const filtered = chatQuestions.filter((q) =>
      q.question.toLowerCase().includes(search.toLowerCase()),
    )
    setFilteredQuestions(filtered)
  }, [addModelOpen, courseId, profile?.chat_token.token, search, chatQuestions])

  const columns = [
    {
      title: 'Question',
      dataIndex: 'question',
      key: 'question',
      sorter: (a, b) => a.question.localeCompare(b.question),
    },
    {
      title: 'Answer',
      dataIndex: 'answer',
      key: 'answer',
      width: 600,
      sorter: (a, b) => a.answer.localeCompare(b.answer),
      render: (text) => <ExpandableText text={text} />,
    },
    {
      title: 'Source Documents',
      dataIndex: 'sourceDocuments',
      key: 'sourceDocuments',
      render: (sourceDocuments) => {
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
      sorter: (a, b) => a.verified - b.verified,
      filters: [
        { text: 'Verified', value: true },
        { text: 'Not Verified', value: false },
      ],
      onFilter: (value, record) => record.verified === value,
      render: (verified) => (
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
      sorter: (a, b) => a.suggested - b.suggested,
      filters: [
        { text: 'Suggested', value: true },
        { text: 'Not Suggested', value: false },
      ],
      onFilter: (value, record) => record.suggested === value,
      render: (suggested) => (
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
      width: 150,
      render: (_, record) => (
        <div>
          <Button
            style={{ marginBottom: '8px' }}
            onClick={() => showEditModal(record)}
          >
            Edit
          </Button>
          <Button
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
          >
            Delete
          </Button>
        </div>
      ),
    },
  ]

  useEffect(() => {
    getQuestions()
  }, [editingRecord, getQuestions])

  const showEditModal = (record) => {
    setEditingRecord(record)
    setEditRecordModalVisible(true)
  }

  const getQuestions = async () => {
    try {
      const response = await fetch(`/chat/${courseId}/allQuestions`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          HMS_API_TOKEN: profile.chat_token.token,
        },
      })

      if (!response.ok) {
        throw new Error('Network response was not ok')
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
      }))

      setChatQuestions(parsedQuestions)
      setFilteredQuestions(parsedQuestions)
    } catch (e) {
      console.error('Failed to fetch questions:', e)
      toast.error('Failed to load questions.')
    }
  }

  const deleteQuestion = async (questionId) => {
    try {
      await fetch(`/chat/${courseId}/question/${questionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          HMS_API_TOKEN: profile.chat_token.token,
        },
      })

      getQuestions()
      toast.success('Question deleted.')
    } catch (e) {
      toast.error('Failed to delete question.')
    }
  }

  return (
    <div className="m-auto my-5 max-w-[1000px]">
      <AddQuestionModal
        visible={addModelOpen}
        onClose={() => setAddModelOpen(false)}
        courseId={courseId}
        existingDocuments={existingDocuments}
        getQuestions={getQuestions}
      />
      <EditQuestionModal
        visible={editRecordModalVisible}
        setEditingRecord={setEditRecordModalVisible}
        editingRecord={editingRecord}
        onSuccessfulUpdate={getQuestions}
      />
      <div className="flex w-full items-center justify-between">
        <div className="">
          <h3 className="m-0 p-0 text-4xl font-bold text-gray-900">
            View Chatbot Questions
          </h3>
          <p className="text-[16px] font-medium text-gray-600">
            View and manage the questions being asked of your chatbot
          </p>
        </div>
        <Button onClick={() => setAddModelOpen(true)}>Add Question</Button>
      </div>
      <hr className="my-5 w-full"></hr>
      <Input
        placeholder={'Search question...'}
        value={search}
        onChange={(e) => {
          e.preventDefault()
          setSearch(e.target.value)
        }}
        onPressEnter={getQuestions}
      />
      <Table
        columns={columns}
        dataSource={filteredQuestions}
        style={{ maxWidth: '1000px' }}
        pagination={{ pageSize: 7 }}
      />
    </div>
  )
}
