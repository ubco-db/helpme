'use client'

import {
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
} from 'react'
import {
  Button,
  Card,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  type TableColumnsType,
  message,
} from 'antd'
import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import type { EmbeddableQuestion, EmbeddableQuiz } from '@koh/common'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import EmbeddableQuestionForm from './EmbeddableQuestionForm'
import EmbeddableQuizForm from './EmbeddableQuizForm'

interface EmbeddableQuestionsPageProps {
  params: Promise<{ cid: string }>
}

type QuizFilter = number | 'unassigned' | undefined

const checkLabels: Record<
  EmbeddableQuestion['gradingSettings']['checks'][number]['kind'],
  string
> = {
  minimum_sentences: 'min sentences',
  maximum_sentences: 'max sentences',
  capitalization: 'capitalization',
}

export default function EmbeddableQuestionsPage(
  props: EmbeddableQuestionsPageProps,
): ReactElement {
  const params = use(props.params)
  const courseId = Number(params.cid)
  const [questions, setQuestions] = useState<EmbeddableQuestion[]>([])
  const [quizzes, setQuizzes] = useState<EmbeddableQuiz[]>([])
  const [loading, setLoading] = useState(true)
  const [questionModalOpen, setQuestionModalOpen] = useState(false)
  const [quizModalOpen, setQuizModalOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<EmbeddableQuestion>()
  const [editingQuiz, setEditingQuiz] = useState<EmbeddableQuiz>()
  const [initialQuizId, setInitialQuizId] = useState<number | undefined>()
  const [quizFilter, setQuizFilter] = useState<QuizFilter>()

  const quizNames = useMemo(
    () => new Map(quizzes.map((quiz) => [quiz.id, quiz.title])),
    [quizzes],
  )

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [nextQuestions, nextQuizzes] = await Promise.all([
        API.lti.embeddableQuestion.getAll(courseId),
        API.lti.embeddableQuiz.getAll(courseId),
      ])
      setQuestions(nextQuestions)
      setQuizzes(nextQuizzes)
    } catch (err) {
      message.error(
        `Failed to load feedback questions: ${getErrorMessage(err)}`,
      )
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const filteredQuestions = useMemo(
    () =>
      questions.filter((question) =>
        quizFilter === undefined
          ? true
          : quizFilter === 'unassigned'
            ? question.quizId === null
            : question.quizId === quizFilter,
      ),
    [questions, quizFilter],
  )

  const deleteQuestion = async (question: EmbeddableQuestion) => {
    try {
      await API.lti.embeddableQuestion.delete(courseId, question.id)
      message.success('Question deleted.')
      void fetchData()
    } catch (err) {
      message.error(`Failed to delete question: ${getErrorMessage(err)}`)
    }
  }

  const duplicateQuestion = async (question: EmbeddableQuestion) => {
    try {
      await API.lti.embeddableQuestion.create(courseId, {
        // Truncate the original title so the " (copy)" suffix fits 255 chars.
        title: `${(question.title || `Question ${question.id}`).slice(0, 248)} (copy)`,
        questionText: question.questionText,
        quizId: question.quizId,
        gradingSettings: structuredClone(question.gradingSettings),
      })
      message.success(
        'Question duplicated. Student responses and feedback are not copied.',
      )
      void fetchData()
    } catch (err) {
      message.error(`Failed to duplicate question: ${getErrorMessage(err)}`)
    }
  }

  const deleteQuiz = async (quiz: EmbeddableQuiz) => {
    try {
      await API.lti.embeddableQuiz.delete(courseId, quiz.id)
      message.success('Quiz deleted.')
      void fetchData()
    } catch (err) {
      message.error(`Failed to delete quiz: ${getErrorMessage(err)}`)
    }
  }

  const openQuestionForm = (question?: EmbeddableQuestion, quizId?: number) => {
    setEditingQuestion(question)
    setInitialQuizId(quizId)
    setQuestionModalOpen(true)
  }

  const questionColumns: TableColumnsType<EmbeddableQuestion> = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: 190,
      render: (title: string, question) => (
        <span className="font-medium text-gray-800">
          {title || `Question ${question.id}`}
        </span>
      ),
    },
    {
      title: 'Quiz',
      dataIndex: 'quizId',
      key: 'quizId',
      width: 170,
      render: (quizId: number | null) =>
        quizId === null ? (
          <span className="text-gray-400">Unassigned</span>
        ) : (
          (quizNames.get(quizId) ?? `Quiz ${quizId}`)
        ),
    },
    {
      title: 'Question text',
      dataIndex: 'questionText',
      key: 'questionText',
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <span>{text}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Score scale',
      key: 'scoreScale',
      width: 140,
      render: (_: unknown, question) => {
        const scale = question.gradingSettings.scoreScale
        return scale.kind === 'range'
          ? `0–${scale.max} by ${scale.step}`
          : scale.values.join(', ')
      },
    },
    {
      title: 'Requirements',
      key: 'checks',
      width: 180,
      render: (_: unknown, question) =>
        question.gradingSettings.checks.length === 0 ? (
          <span className="text-gray-400">None</span>
        ) : (
          <Space size={[0, 4]} wrap>
            {question.gradingSettings.checks.map((check, index) => (
              <Tag key={`${check.kind}-${index}`}>
                {checkLabels[check.kind]}
              </Tag>
            ))}
          </Space>
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 170,
      render: (_: unknown, question) => (
        <Space size="small">
          <Button
            icon={<CopyOutlined />}
            size="small"
            aria-label={`Duplicate ${question.title || `Question ${question.id}`}`}
            onClick={() => duplicateQuestion(question)}
          />
          <Button
            icon={<EditOutlined />}
            size="small"
            aria-label={`Edit ${question.title || `Question ${question.id}`}`}
            onClick={() => openQuestionForm(question)}
          />
          <Popconfirm
            title="Delete this question?"
            description="This action cannot be undone."
            onConfirm={() => deleteQuestion(question)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Button
              icon={<DeleteOutlined />}
              size="small"
              danger
              aria-label={`Delete ${question.title || `Question ${question.id}`}`}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const quizColumns: TableColumnsType<EmbeddableQuiz> = [
    {
      title: 'Quiz title',
      dataIndex: 'title',
      key: 'title',
      width: 220,
    },
    {
      title: 'Objective',
      dataIndex: 'objective',
      key: 'objective',
      ellipsis: true,
      render: (objective: string) =>
        objective || <span className="text-gray-400">—</span>,
    },
    {
      title: 'Questions',
      key: 'questions',
      width: 100,
      render: (_: unknown, quiz) =>
        questions.filter((question) => question.quizId === quiz.id).length,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      render: (_: unknown, quiz) => (
        <Space size="small">
          <Button
            icon={<PlusOutlined />}
            size="small"
            aria-label={`Add question to ${quiz.title}`}
            onClick={() => openQuestionForm(undefined, quiz.id)}
          >
            Add question
          </Button>
          <Button
            icon={<EditOutlined />}
            size="small"
            aria-label={`Edit ${quiz.title}`}
            onClick={() => {
              setEditingQuiz(quiz)
              setQuizModalOpen(true)
            }}
          />
          <Popconfirm
            title="Delete this quiz?"
            description="Move or unassign its questions first; a quiz with linked questions cannot be deleted."
            onConfirm={() => deleteQuiz(quiz)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Button
              icon={<DeleteOutlined />}
              size="small"
              danger
              aria-label={`Delete ${quiz.title}`}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Card
      title="Feedback Questions"
      classNames={{ body: 'p-1 md:p-6' }}
      extra={
        <Space wrap>
          <Button
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingQuiz(undefined)
              setQuizModalOpen(true)
            }}
          >
            Create Quiz
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openQuestionForm()}
          >
            Create Question
          </Button>
        </Space>
      }
    >
      <p className="mb-4 text-gray-600">
        A quiz provides optional shared objective and background. Each question
        has its own main grading prompt, feedback and final grading
        instructions, score scale, and optional answer requirements.
      </p>

      <Card title="Quizzes" size="small" className="mb-4">
        <Table
          dataSource={quizzes}
          columns={quizColumns}
          rowKey="id"
          loading={loading}
          pagination={false}
          locale={{
            emptyText:
              'No quizzes yet. Create one when questions share context.',
          }}
        />
      </Card>

      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="mb-0 text-lg font-semibold">Questions</h2>
        <Select<QuizFilter>
          allowClear
          value={quizFilter}
          onChange={(value) => setQuizFilter(value)}
          placeholder="Filter by quiz"
          options={[
            { value: 'unassigned', label: 'Unassigned questions' },
            ...quizzes.map((quiz) => ({ value: quiz.id, label: quiz.title })),
          ]}
          className="min-w-52"
        />
      </div>
      <Table
        dataSource={filteredQuestions}
        columns={questionColumns}
        rowKey="id"
        loading={loading}
        pagination={false}
        locale={{
          emptyText:
            'No questions match this filter. Create a question to start collecting feedback.',
        }}
      />

      <EmbeddableQuizForm
        courseId={courseId}
        open={quizModalOpen}
        setOpen={setQuizModalOpen}
        editingQuiz={editingQuiz}
        onSaveCallback={() => void fetchData()}
      />
      <EmbeddableQuestionForm
        courseId={courseId}
        quizzes={quizzes}
        open={questionModalOpen}
        setOpen={setQuestionModalOpen}
        editingQuestion={editingQuestion}
        initialQuizId={initialQuizId}
        onSaveCallback={() => void fetchData()}
      />
    </Card>
  )
}
