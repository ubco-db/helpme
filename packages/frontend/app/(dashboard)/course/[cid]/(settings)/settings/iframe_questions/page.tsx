'use client'

import {
  ReactElement,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  Button,
  Card,
  Input,
  message,
  Modal,
  Popconfirm,
  Table,
  Space,
} from 'antd'
import {
  DeleteOutlined,
  CopyOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { IframeQuestion } from '@koh/common'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'

const { TextArea } = Input

interface IframeQuestionsPageProps {
  params: Promise<{ cid: string }>
}

export default function IframeQuestionsPage(
  props: IframeQuestionsPageProps,
): ReactElement {
  const params = use(props.params)
  const courseId = useMemo(() => Number(params.cid), [params.cid])

  const [questions, setQuestions] = useState<IframeQuestion[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<IframeQuestion | null>(
    null,
  )
  const [questionText, setQuestionText] = useState('')
  const [criteriaText, setCriteriaText] = useState('')

  const fetchQuestions = useCallback(async () => {
    setLoading(true)
    try {
      const data = await API.iframeQuestion.getAll(courseId)
      setQuestions(data)
    } catch (err) {
      message.error(`Failed to load questions: ${getErrorMessage(err)}`)
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    fetchQuestions()
  }, [fetchQuestions])

  const openCreateModal = () => {
    setEditingQuestion(null)
    setQuestionText('')
    setCriteriaText('')
    setModalOpen(true)
  }

  const openEditModal = (q: IframeQuestion) => {
    setEditingQuestion(q)
    setQuestionText(q.questionText)
    setCriteriaText(q.criteriaText)
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!questionText.trim()) {
      message.warning('Question text is required')
      return
    }
    if (!criteriaText.trim()) {
      message.warning('Criteria is required')
      return
    }
    try {
      if (editingQuestion) {
        await API.iframeQuestion.update(courseId, editingQuestion.id, {
          questionText: questionText.trim(),
          criteriaText: criteriaText.trim(),
        })
        message.success('Question updated')
      } else {
        await API.iframeQuestion.create(courseId, {
          questionText: questionText.trim(),
          criteriaText: criteriaText.trim(),
        })
        message.success('Question created')
      }
      setModalOpen(false)
      fetchQuestions()
    } catch (err) {
      message.error(`Failed to save question: ${getErrorMessage(err)}`)
    }
  }

  const handleDelete = async (q: IframeQuestion) => {
    try {
      await API.iframeQuestion.delete(courseId, q.id)
      message.success('Question deleted')
      fetchQuestions()
    } catch (err) {
      message.error(`Failed to delete question: ${getErrorMessage(err)}`)
    }
  }

  const getIframeUrl = (q: IframeQuestion) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}/lti/iframe/${courseId}?q=${q.id}`
  }

  const copyIframeUrl = (q: IframeQuestion) => {
    const url = getIframeUrl(q)
    const embedCode = `<iframe src="${url}" width="100%" height="300" frameborder="0" scrolling="no" style="border:0;"></iframe>`
    navigator.clipboard.writeText(embedCode)
    message.success('Embed code copied to clipboard')
  }

  const columns = [
    {
      title: 'Question',
      dataIndex: 'questionText',
      key: 'questionText',
      ellipsis: true,
    },
    {
      title: 'Criteria',
      dataIndex: 'criteriaText',
      key: 'criteriaText',
      ellipsis: true,
    },
    {
      title: 'Iframe Link',
      key: 'link',
      width: 120,
      render: (_: any, record: IframeQuestion) => (
        <Button
          icon={<CopyOutlined />}
          size="small"
          onClick={() => copyIframeUrl(record)}
        >
          Copy Link
        </Button>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: any, record: IframeQuestion) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => openEditModal(record)}
          />
          <Popconfirm
            title="Delete this question?"
            description="This action cannot be undone."
            onConfirm={() => handleDelete(record)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Button icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Card
      title="Iframe Questions"
      classNames={{
        body: 'p-1 md:p-8',
      }}
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreateModal}
        >
          Create Question
        </Button>
      }
    >
      <p className="mb-4 text-gray-500">
        Create questions that can be embedded as iframes in Canvas or other LMS
        platforms. Students will see the question and can submit a response to
        get AI feedback.
      </p>
      <Table
        dataSource={questions}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
        locale={{
          emptyText: 'No iframe questions yet. Create one to get started.',
        }}
      />
      <Modal
        title={editingQuestion ? 'Edit Question' : 'Create Question'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        okText={editingQuestion ? 'Save' : 'Create'}
      >
        <div className="space-y-4 pt-2">
          <div>
            <label className="mb-1 block font-medium">Question Text</label>
            <TextArea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={3}
              placeholder="e.g. Reflect on how the themes in this week's reading relate to your own experience."
            />
          </div>
          <div>
            <label className="mb-1 block font-medium">Criteria</label>
            <TextArea
              value={criteriaText}
              onChange={(e) => setCriteriaText(e.target.value)}
              rows={3}
              placeholder="e.g. The response should reference at least two specific themes and provide personal examples."
            />
            <p className="mt-1 text-xs font-medium text-red-500">
              Important: The AI prompt uses only the Question Text and Criteria
              you enter here. Nothing else is included. Course prompt, HelpMe
              system prompt, and chatbot knowledge base are not used for iframe
              feedback.
            </p>
          </div>
        </div>
      </Modal>
    </Card>
  )
}
