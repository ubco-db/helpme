import ExpandableText from '@/app/components/ExpandableText'
import ExpandableAIResponse from '@/app/(dashboard)/course/[cid]/(settings)/settings/components/ExpandableAIResponse'
import { formatDateAndTimeForExcel } from '@/app/utils/timeFormatUtils'
import { Button, Popconfirm, Table } from 'antd'
import { DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { EmbeddableFeedback } from '@koh/common'
import FeedbackGrade from '@/app/(dashboard)/course/[cid]/(settings)/settings/(embeddable)/components/FeedbackGrade'
import { useMemo } from 'react'

type EmbeddableFeedbackTableProps = {
  feedback: EmbeddableFeedback[]
  loading?: boolean
  handleDelete: (record: Feedback) => void
  selectFeedback: (record: Feedback) => void
}

export type Feedback = {
  isChild: boolean,
} & EmbeddableFeedback

export type EmbeddableFeedbackGroup = {
  answers?: Feedback[],
} & Feedback

const EmbeddableFeedbackTable: React.FC<EmbeddableFeedbackTableProps> = ({
  feedback,
  loading = false,
  handleDelete,
  selectFeedback,
}) => {
  const processed = useMemo(() => processQuestionAnswers(feedback), [feedback])

  const columns: any[] = [
    {
      title: 'User',
      dataIndex: ['user','name'],
      key: 'name',
      render: (text: string, record: EmbeddableFeedbackGroup) => (
        !record.isChild ? text : ''
      )
    },
    {
      title: 'Submission',
      dataIndex: 'submission',
      key: 'submission',
      width: 300,
      render: (text: string) => {
        return (
          <ExpandableText maxRows={3}>
            {text ? text.toString() : ''}
          </ExpandableText>
        )
      },
    },
    {
      title: 'AI Feedback',
      dataIndex: 'aiFeedback',
      key: 'aiFeedback',
      width: 300,
      render: (text: string) => (<ExpandableAIResponse response={text}/>),
    },
    {
      title: 'AI Grade',
      dataIndex: 'aiGrade',
      key: 'aiGrade',
      width: 90,
      render: (grade?: number) => (<FeedbackGrade grade={grade}/>)
    },
    {
      title: 'Human Grade',
      dataIndex: 'humanGrade',
      key: 'humanGrade',
      width: 90,
      render: (grade?: number) => (<FeedbackGrade grade={grade}/>)
    },
    {
      title: 'Human Feedback',
      dataIndex: 'humanFeedback',
      key: 'humanFeedback',
      width: 90,
      render: (text?: string) => (
        <ExpandableText maxRows={3}>
          {text}
        </ExpandableText>
      )
    },
    {
      title: 'Time',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 90,
      render: (createdAt: Date) => formatDateAndTimeForExcel(createdAt),
    },
    {
      key: 'actions',
      width: 50,
      render: (_: any, record: Feedback) => (
        <div className="flex flex-col items-center justify-center gap-2">
          {!record.isChild && (
            <Button icon={<EditOutlined/>} size="small" onClick={() => selectFeedback(record)} />
          )}
          <Popconfirm
            title="Delete this submission?"
            description="This action cannot be undone."
            onConfirm={() => handleDelete(record)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Button icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </div>
      ),
    },
  ]

  return (
    <Table<EmbeddableFeedbackGroup>
      columns={columns}
      bordered
      size="small"
      dataSource={processed}
      loading={processed.length === 0 && loading}
      expandable={{
        childrenColumnName: 'answers',
      }}
    />
  )
}

function processQuestionAnswers(
  answers: EmbeddableFeedback[],
): EmbeddableFeedbackGroup[] {
  const feedbackGroups: EmbeddableFeedbackGroup[] = []

  const uniqueUsers: number[] = [...new Set(answers.map(a => a.userId))]

  uniqueUsers.forEach(uid => {
    const ans = answers
      .filter(a => a.userId == uid)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const children = ans.slice(1).map(a => ({ ...a, isChild: true }))

    feedbackGroups.push({
      ...ans[0],
      isChild: false,
      answers: children.length > 0 ? children : undefined
    })
  })

  return feedbackGroups;
}

export default EmbeddableFeedbackTable
