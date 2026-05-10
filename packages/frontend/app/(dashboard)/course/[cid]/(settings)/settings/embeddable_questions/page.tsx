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
  message,
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
import { EmbeddableQuestion } from '@koh/common'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import UpsertEmbeddableQuestionModal
  from '@/app/(dashboard)/course/[cid]/(settings)/settings/embeddable_questions/components/UpsertEmbeddableQuestionModal'

interface EmbeddableQuestionsPageProps {
  params: Promise<{ cid: string }>
}

export default function EmbeddableQuestionsPage(
  props: EmbeddableQuestionsPageProps,
): ReactElement {
  const params = use(props.params)
  const courseId = useMemo(() => Number(params.cid), [params.cid])

  const [questions, setQuestions] = useState<EmbeddableQuestion[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<EmbeddableQuestion | undefined>(undefined)
  
  const fetchQuestions = useCallback(async () => {
    setLoading(true)
    try {
      const data = await API.lti.embeddableQuestion.getAll(courseId)
      setQuestions(data)
    } catch (err) {
      message.error(`Failed to load questions: ${getErrorMessage(err)}`)
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    fetchQuestions().then()
  }, [fetchQuestions])

  const openCreateModal = () => {
    setEditingQuestion(undefined)
    setModalOpen(true)
  }

  const openEditModal = (q: EmbeddableQuestion) => {
    setEditingQuestion(q)
    setModalOpen(true)
  }

  const handleDelete = async (q: EmbeddableQuestion) => {
    try {
      await API.lti.embeddableQuestion.delete(courseId, q.id)
      message.success('Successfully deleted question!')
      fetchQuestions()
    } catch (err) {
      message.error(`Failed to delete question: ${getErrorMessage(err)}`)
    }
  }

  const getIFrameUrl = (q: EmbeddableQuestion) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}/lti/embeddable-question/${courseId}/${q.id}`
  }

  const copyIFrameUrl = (q: EmbeddableQuestion) => {
    const url = getIFrameUrl(q)
    const embedCode = `<iframe src="${url}" width="100%" height="300" style="border:0;"></iframe>`
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
      title: 'Additional Instructions',
      dataIndex: 'instructions',
      key: 'instructions',
      ellipsis: true,
    },
    {
      title: 'IFrame Link',
      key: 'link',
      width: 120,
      render: (_: any, record: EmbeddableQuestion) => (
        <Button
          icon={<CopyOutlined />}
          size="small"
          onClick={() => copyIFrameUrl(record)}
        >
          Copy Link
        </Button>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: any, record: EmbeddableQuestion) => (
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
      title="Embeddable Questions"
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
          emptyText: 'There have been no embeddable questions created for this course yet!',
        }}
      />
      <UpsertEmbeddableQuestionModal
        courseId={courseId}
        open={modalOpen}
        setOpen={setModalOpen}
        editingQuestion={editingQuestion}
        onSaveCallback={() => fetchQuestions()}
      />
    </Card>
  )
}
