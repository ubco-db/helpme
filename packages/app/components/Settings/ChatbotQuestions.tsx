import {
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Pagination,
  Select,
  Switch,
  Table,
  Tooltip,
  message,
} from 'antd'
import React, { ReactElement, useEffect, useState } from 'react'
import { API } from '@koh/api-client'
import toast from 'react-hot-toast'
import ExpandableText from '../common/ExpandableText'
import EditChatbotQuestionModal from './EditChatbotQuestionModal'
import { useProfile } from '../../hooks/useProfile'

interface Loc {
  pageNumber: number
}

interface SourceDocument {
  id: string
  metadata: {
    loc: Loc
    name: string
    type: string
    source: string
    courseId: string
  }
  pageContent: string
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
  const [editRecordModalVisible, setEditRecordModalVisible] = useState(false)
  const [chatQuestions, setChatQuestions] = useState<ChatbotQuestion[]>([])
  const [existingDocuments, setExistingDocuments] = useState([])
  const [selectedDocuments, setSelectedDocuments] = useState([])

  useEffect(() => {
    fetch(`/chat/${courseId}/aggregateDocuments`)
      .then((res) => res.json())
      .then((json) => {
        // Convert the json to the expected format
        const formattedDocuments = json.map((doc) => ({
          docId: doc.id,
          docName: doc.pageContent,
          sourceLink: doc.metadata.source,
          pageNumbers: [],
        }))
        setExistingDocuments(formattedDocuments)
      })
  }, [addModelOpen, courseId])

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
                  <a
                    href={doc.sourceLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {doc.docName}
                  </a>
                </div>
                <div className="mt-1 flex flex-wrap gap-1 text-xs">
                  {doc.pageNumbers.map((pageNumber) => (
                    <span
                      key={`${doc.docName}-${pageNumber}`}
                      className="whitespace-nowrap"
                    >
                      p.{pageNumber}
                    </span>
                  ))}
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
          className={`rounded px-2 py-1 ${
            verified ? 'bg-green-100' : 'bg-red-100'
          }`}
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
          className={`rounded px-2 py-1 ${
            suggested ? 'bg-green-100' : 'bg-red-100'
          }`}
        >
          {suggested ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      title: 'Edit',
      dataIndex: 'edit',
      key: 'edit',
      render: (_, record) => (
        <Button onClick={() => showModal(record)}>Edit</Button>
      ),
    },
    {
      title: 'Delete',
      dataIndex: 'delete',
      key: 'delete',
      render: (_, record) => (
        <Button
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
      ),
    },
  ]

  useEffect(() => {
    getQuestions()
  }, [editingRecord])

  const showModal = (record) => {
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
    } catch (e) {
      console.error('Failed to fetch questions:', e)
      toast.error('Failed to load questions.')
    }
  }

  const addQuestion = async () => {
    const formData = await form.validateFields()

    try {
      selectedDocuments.forEach((doc) => {
        if (typeof doc.pageNumbers === 'string') {
          // Convert string to array of numbers, trimming spaces and ignoring empty entries
          doc.pageNumbers = doc.pageNumbers
            .split(',')
            .map((page) => page.trim())
            .filter((page) => page !== '')
            .map((page) => parseInt(page, 10))
        }
      })

      await fetch(`/chat/${courseId}/question`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: formData.questionText,
          answer: formData.responseText,
          verified: formData.verified,
          suggested: formData.suggested,
          sourceDocuments: selectedDocuments,
        }),
      })

      getQuestions()
      setAddModelOpen(false)
      toast.success('Question added.')
    } catch (e) {
      toast.error('Failed to add question.' + e)
    } finally {
      form.resetFields()
    }
  }

  const deleteQuestion = async (questionId) => {
    try {
      await fetch(`/chat/${courseId}/question/${questionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
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
      <Modal
        title="Create a new question for your students!"
        open={addModelOpen}
        onCancel={() => setAddModelOpen(false)}
        footer={[
          <Button key="ok" type="ghost" onClick={() => setAddModelOpen(false)}>
            Cancel
          </Button>,
          <Button key="ok" type="primary" onClick={addQuestion}>
            Submit
          </Button>,
        ]}
      >
        <Form form={form}>
          <Form.Item
            label="Question"
            name="questionText"
            rules={[
              {
                required: true,
                message: 'Please input a question!',
              },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Answer"
            name="responseText"
            rules={[
              {
                required: true,
                message: 'Please input an answer!',
              },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Verified"
            name="verified"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>
          <Form.Item
            label="Suggested"
            name="suggested"
            valuePropName="checked"
            initialValue={false}
          >
            <Switch />
          </Form.Item>
          <Select
            className="my-4"
            placeholder="Select a document to add"
            style={{ width: '100%' }}
            onSelect={(selectedDocId) => {
              const selectedDoc = existingDocuments.find(
                (doc) => doc.docId === selectedDocId,
              )
              if (selectedDoc) {
                setSelectedDocuments((prev) => {
                  const isAlreadySelected = prev.some(
                    (doc) => doc.docId === selectedDocId,
                  )
                  if (!isAlreadySelected) {
                    return [...prev, { ...selectedDoc, pageNumbers: [] }]
                  }
                  return prev
                })
              }
            }}
          >
            {existingDocuments.map((doc) => (
              <Select.Option key={doc.docId} value={doc.docId}>
                {doc.docName}
              </Select.Option>
            ))}
          </Select>

          {selectedDocuments.map((doc, index) => (
            <div key={doc.docId}>
              <span className="font-bold">{doc.docName}</span>
              <Input
                type="text"
                placeholder="Enter page numbers (comma separated)"
                value={doc.pageNumbers}
                onChange={(e) => {
                  const updatedPageNumbers = e.target.value
                  // Split by comma, trim whitespace, filter empty strings, convert to numbers
                  const pageNumbersArray = updatedPageNumbers
                    .split(',')
                    .map(Number)
                  setSelectedDocuments((prev) =>
                    prev.map((d, idx) =>
                      idx === index
                        ? { ...d, pageNumbers: pageNumbersArray } // array of numbers
                        : d,
                    ),
                  )
                }}
              />
            </div>
          ))}
        </Form>
      </Modal>
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
        // prefix={<SearchOutlined />}
        value={search}
        onChange={(e) => {
          e.preventDefault()
          setSearch(e.target.value)
        }}
        onPressEnter={getQuestions}
      />
      <Table
        columns={columns}
        dataSource={chatQuestions}
        style={{ maxWidth: '1000px' }}
        pagination={{ pageSize: 7 }}
      />

      <EditChatbotQuestionModal
        editingRecord={editingRecord}
        visible={editRecordModalVisible}
        setEditingRecord={setEditRecordModalVisible}
        onSuccessfulUpdate={getQuestions}
      />
    </div>
  )
}
