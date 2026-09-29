'use client'

import { use, useState, type ReactElement } from 'react'
import {
  Button,
  Card,
  Popconfirm,
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
import useSWRImmutable from 'swr/immutable'
import type { EmbeddableQuestion } from '@koh/common'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import EmbeddableQuestionForm from './EmbeddableQuestionForm'

interface EmbeddableQuestionsPageProps {
  params: Promise<{ cid: string }>
}

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
  const [questionModalOpen, setQuestionModalOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<EmbeddableQuestion>()

  // SWR owns the fetched data and loading state; saves and deletes just
  // revalidate it.
  const {
    data,
    isLoading,
    mutate: refetch,
  } = useSWRImmutable(
    `lti/embeddable-questions/${courseId}`,
    () => API.lti.embeddableQuestion.getAll(courseId),
    {
      onError: (err) =>
        message.error(
          `Failed to load embeddable questions: ${getErrorMessage(err)}`,
        ),
    },
  )
  const { data: integration } = useSWRImmutable(`lms/course/${courseId}`, () =>
    API.lmsIntegration.getCourseIntegration(courseId),
  )
  const platformName =
    integration?.apiPlatform && integration.apiPlatform !== 'None'
      ? integration.apiPlatform
      : 'your LMS'
  const questions = data ?? []

  const deleteQuestion = async (question: EmbeddableQuestion) => {
    try {
      await API.lti.embeddableQuestion.delete(courseId, question.id)
      message.success('Question deleted.')
      void refetch()
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
        gradingSettings: structuredClone(question.gradingSettings),
      })
      message.success(
        'Question duplicated. Student responses and feedback are not copied.',
      )
      void refetch()
    } catch (err) {
      message.error(`Failed to duplicate question: ${getErrorMessage(err)}`)
    }
  }

  const openQuestionForm = (question?: EmbeddableQuestion) => {
    setEditingQuestion(question)
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
        return `0–${scale.max} by ${scale.step}`
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
            description="This permanently deletes the question, all student responses, and all feedback. Existing links in your LMS will stop working."
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

  return (
    <Card
      title="Embeddable Questions"
      className="min-w-0"
      classNames={{
        body: 'p-3 md:p-6',
        header: 'px-3 py-3 md:px-6',
        title: 'whitespace-normal',
      }}
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => openQuestionForm()}
        >
          Create Question
        </Button>
      }
    >
      <p className="mb-2 text-gray-600">
        Embeddable questions let students submit answers and receive provisional
        AI feedback inside {platformName}, helping them improve their answers.
      </p>
      <p className="mb-4 text-gray-600">
        Each question has its own grading prompt, feedback instructions, score
        scale, and optional answer requirements.
      </p>
      <p className="mb-4 text-gray-600">
        After creating a question here, use the HelpMe app in the {platformName}{' '}
        content editor to insert it. In Canvas, open Apps, choose View All, then
        HelpMe. Select a question and choose Insert into Canvas.{' '}
        <a
          href="/actually_public/canvas_insert_embedded_question.png"
          target="_blank"
          rel="noopener noreferrer"
        >
          See where to find HelpMe in Canvas (opens in a new tab).
        </a>
      </p>

      <Table
        dataSource={questions}
        columns={questionColumns}
        rowKey="id"
        loading={isLoading}
        pagination={false}
        scroll={{ x: 850 }}
        locale={{
          emptyText:
            'No questions yet. Create a question to start collecting feedback.',
        }}
      />

      <EmbeddableQuestionForm
        courseId={courseId}
        open={questionModalOpen}
        setOpen={setQuestionModalOpen}
        editingQuestion={editingQuestion}
        onSaveCallback={() => void refetch()}
      />
    </Card>
  )
}
