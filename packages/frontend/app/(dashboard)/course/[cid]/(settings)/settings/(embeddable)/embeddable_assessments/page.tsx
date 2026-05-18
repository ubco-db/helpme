'use client'

import { ReactElement, use, useEffect, useMemo, useState } from 'react'
import {
  useEmbeddableAssignment,
} from '@/app/(dashboard)/course/[cid]/(settings)/settings/(embeddable)/context/embeddableAssignmentContext'
import { API } from '@/app/api'
import { Button, Card, Collapse, List, message, Popconfirm, Space, Table } from 'antd'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { CopyOutlined, DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons'
import { EmbeddableAssignment, EmbeddableAssignmentQuestion, EmbeddableQuestion } from '@koh/common'
import EmbeddableQuestionDisplay
  from '@/app/(dashboard)/course/[cid]/(settings)/settings/(embeddable)/components/EmbeddableQuestionDisplay'
import UpsertEmbeddableAssignmentModal from './components/UpsertEmbeddableAssignmentModal'

interface EmbeddableAssessmentsPageProps {
  params: Promise<{ cid: string }>
}

export default function EmbeddableAssessmentsPage(
  props: EmbeddableAssessmentsPageProps,
): ReactElement {
  const params = use(props.params)
  const courseId = useMemo(() => Number(params.cid), [params.cid])

  const { assignments, setCourseId, retrieveAssignments } = useEmbeddableAssignment()
  useEffect(() => {
    setCourseId(courseId)
  }, [courseId, setCourseId])

  const [modalOpen, setModalOpen] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<EmbeddableAssignment | undefined>(undefined)

  const openCreateModal = () => {
    setEditingAssignment(undefined)
    setModalOpen(true)
  }

  const openEditModal = (a: EmbeddableAssignment) => {
    setEditingAssignment(a)
    setModalOpen(true)
  }

  const handleDelete = async (a: EmbeddableAssignment) => {
    try {
      await API.lti.embeddableQuestion.assignment.delete(courseId, a.id)
      message.success('Successfully deleted question!')
      retrieveAssignments()
    } catch (err) {
      message.error(`Failed to delete question: ${getErrorMessage(err)}`)
    }
  }

  const getIFrameUrl = (a: EmbeddableAssignment) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}/lti/embeddable/${courseId}/assessment/${a.id}`
  }

  const copyIFrameUrl = (a: EmbeddableAssignment) => {
    const url = getIFrameUrl(a)
    const embedCode = `<iframe src="${url}" width="100%" height="300" style="border:0;"></iframe>`
    navigator.clipboard.writeText(embedCode)
    message.success('Embed code copied to clipboard')
  }

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <b>{name}</b>
      )
    },
    {
      title: 'Questions',
      dataIndex: 'questions',
      key: 'questions',
      render: (questions: EmbeddableAssignmentQuestion[]) => (
        <Collapse
          items={[
            {
              key: 'items',
              label: `Questions (${questions.length})`,
              children: (
                <List
                  dataSource={questions.map(v => v.question)}
                  renderItem={(item: EmbeddableQuestion) => (
                    <List.Item className={'border:zinc-200 border-2 rounded-md p-2 w-full'}>
                      <EmbeddableQuestionDisplay item={item} showDates={false} />
                    </List.Item>
                  )}
                />
              )
            }
          ]}
        />
      )
    },
    {
      title: 'Opens',
      dataIndex: 'availableFrom',
      width: 40,
      render: (time?: Date) => (
        <span>{time != undefined ? new Date(time).toString() : 'Always'}</span>
      )
    },
    {
      title: 'Closes',
      dataIndex: 'availableUntil',
      width: 40,
      render: (time?: Date) => (
        <span>{time != undefined ? new Date(time).toString() : 'Never'}</span>
      )
    },
    {
      title: 'IFrame Link',
      key: 'link',
      width: 120,
      render: (_: any, record: EmbeddableAssignment) => (
        <div className={'flex flex-col'}>
          <Button
            icon={<CopyOutlined />}
            size="small"
            onClick={() => copyIFrameUrl(record)}
          >
            Copy Link
          </Button>
          <Button
            icon={<EyeOutlined/>}
            size="small"
            href={getIFrameUrl(record)}
            target={'_blank'}
          >
            Preview
          </Button>
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: any, record: EmbeddableAssignment) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => openEditModal(record)}
          />
          <Popconfirm
            title="Delete this assessment?"
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
    <>
      <UpsertEmbeddableAssignmentModal
        courseId={courseId}
        open={modalOpen}
        setOpen={setModalOpen}
        editingAssignment={editingAssignment}
        onSaveCallback={() => retrieveAssignments()}
      />
      <Card
        title="Embeddable Assessments"
        classNames={{
          body: 'p-1 md:p-8',
        }}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateModal}
          >
            Create Assessment
          </Button>
        }
      >
        <p className="mb-4 text-gray-500">
          Create embeddable assessments using existing questions, or create them on the fly.
        </p>
        <p className="mb-4 text-gray-500">
          Like embeddable questions, these can be embedded as iframes in Canvas or other LMS
          platforms. Students will see the assessment as a series of questions and can submit a response to each
          obtain AI feedback.
        </p>
        <Table
          dataSource={assignments}
          columns={columns}
          rowKey="id"
          pagination={false}
          locale={{
            emptyText: 'There have been no embeddable assessments created for this course yet!',
          }}
        />
      </Card>
    </>
  )
}

