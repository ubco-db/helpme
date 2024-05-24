import { Button, Form, Input, Modal, Pagination, Table, message } from 'antd'
import React, { ReactElement, useEffect, useState } from 'react'
import { API } from '@koh/api-client'
import toast from 'react-hot-toast'
import ExpandableText from '../common/ExpandableText'
import EditChatbotQuestionModal from './EditChatbotQuestionModal'
import { get, set } from 'lodash'
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
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [editingRecord, setEditingRecord] = useState(null)
  const [editRecordModalVisible, setEditRecordModalVisible] = useState(false)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [chatQuestions, setChatQuestions] = useState<ChatbotQuestion[]>([])
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
    // {
    //   title: () => (
    //     <>
    //       <Tooltip
    //         title="Suggest this question to students when they initially start with the chatbot."
    //         trigger="click"
    //         defaultOpen
    //       >
    //         <p>Suggested</p>
    //       </Tooltip>
    //     </>
    //   ),
    //   dataIndex: 'suggested',
    //   key: 'suggested',
    //   render: (text, record, index) => {
    //     return (
    //       <Checkbox
    //         disabled={loading}
    //         checked={record.suggested}
    //         onChange={(e) => {
    //           toggleSuggested(e.target.checked, index, record.id)
    //         }}
    //       />
    //     )
    //   },
    // },
    {
      title: 'Edit',
      dataIndex: 'edit',
      key: 'edit',
      render: (_, record) => (
        <Button onClick={() => showModal(record)}>Edit</Button>
      ),
    },
  ]

  useEffect(() => {
    getQuestions()
  }, [editingRecord])

  // const toggleSuggested = async (newValue, index, questionId) => {
  //   // TODO: Loading & contextual disabling
  //   setLoading(true)
  //   try {
  //     await API.chatbot.editQuestion({
  //       data: {
  //         suggested: newValue,
  //       },
  //       questionId,
  //     })

  //     setChatQuestions((prev) => {
  //       const newChatQuestions = [...prev]
  //       newChatQuestions[index] = {
  //         ...newChatQuestions[index],
  //         suggested: newValue,
  //       }
  //       return newChatQuestions
  //     })
  //   } catch (e) {
  //     console.log(e)
  //   }
  //   setLoading(false)
  // }

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
        suggested: false,
      }))

      setChatQuestions(parsedQuestions)
      setTotalQuestions(parsedQuestions.length)
    } catch (e) {
      console.error('Failed to fetch questions:', e)
      toast.error('Failed to load questions.')
    }
  }

  const addQuestion = async () => {
    const formData = await form.validateFields()

    try {
      await API.chatbot.createQuestion({
        questionText: formData.questionText,
        responseText: formData.responseText,
        suggested: formData.suggested,
      })

      getQuestions()
      setAddModelOpen(false)
      toast.success('Question added.')
    } catch (e) {
      toast.error('Failed to add question.')
    } finally {
      form.resetFields()
    }
  }

  return (
    <div className="m-auto my-5 max-w-[800px]">
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
            name="questionText"
            rules={[{ required: true, message: 'Please provide a question.' }]}
          >
            <Input placeholder="Question" />
          </Form.Item>
          <Form.Item
            name="responseText"
            rules={[{ required: true, message: 'Please provide an answer.' }]}
          >
            <Input placeholder="Answer" />
          </Form.Item>
          <Form.Item name="suggested" valuePropName="checked">
            <div className="flex gap-2">
              <input type="checkbox" />
              <p>Suggested</p>
            </div>
          </Form.Item>
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
        {/* <Button onClick={() => setAddModelOpen(true)}>Add Question</Button> */}
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
        style={{ maxWidth: '800px' }}
        pagination={false}
      />
      <EditChatbotQuestionModal
        editingRecord={editingRecord}
        visible={editRecordModalVisible}
        setEditingRecord={setEditRecordModalVisible}
        onSuccessfulUpdate={getQuestions}
      />
      <Pagination
        style={{ float: 'right' }}
        current={currentPage}
        pageSize={pageSize}
        total={totalQuestions}
        onChange={(page) => setCurrentPage(page)}
        pageSizeOptions={[10, 20, 30, 50]}
        showSizeChanger
        onShowSizeChange={(current, pageSize) => setPageSize(pageSize)}
      />
    </div>
  )
}
