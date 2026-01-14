'use client'

import {
  Button,
  Collapse,
  Divider,
  Input,
  List,
  message,
  Table,
  Tooltip,
} from 'antd'
import {
  ReactElement,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import ExpandableText from '@/app/components/ExpandableText'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { useUserInfo } from '@/app/contexts/userContext'
import UpsertChatbotQuestionModal from './components/UpsertChatbotQuestionModal'
import { EditOutlined, PlusCircleOutlined } from '@ant-design/icons'
import Highlighter from 'react-highlight-words'
import { formatDateAndTimeForExcel } from '@/app/utils/timeFormatUtils'
import { API } from '@/app/api'
import {
  ChatbotCitationResponse,
  ChatbotDocumentListResponse,
  ChatbotDocumentResponse,
  parseThinkBlock,
} from '@koh/common'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import ChatbotHelpTooltip from '../components/ChatbotHelpTooltip'
import {
  extractWords,
  mapChatbotDocumentsToListForm,
  QuestionListItem,
} from '@/app/(dashboard)/course/[cid]/(settings)/settings/util'
import CustomPagination from '@/app/(dashboard)/course/[cid]/(settings)/settings/components/CustomPagination'
import ChatbotListDocumentItem from '@/app/(dashboard)/course/[cid]/(settings)/settings/components/ChatbotListDocumentItem'

const overrides = `
:root {
    --base-white: #ffffff;
    --base-gray: #fafafa;
    --base-border: #f4f4f4;
    --hover-darken: 98%;
    --border-darken: 95%;
    --sort-darken: 95%;
    --darken-per-level: 10%;

    --head-cell: var(--base-gray);
    --head-cell-border: var(--base-border);
    --head-cell-hover: color-mix(in srgb, var(--head-cell) var(--hover-darken), white);
    --head-cell-border-hover: color-mix(in srgb, var(--head-cell-border) var(--hover-darken), black);

    --head-sort-cell: color-mix(in srgb, var(--head-cell) var(--sort-darken), black);
    --head-sort-cell-border: color-mix(in srgb, var(--head-cell-border) var(--border-darken), black);
    --head-sort-cell-hover: color-mix(in srgb, var(--head-sort-cell) var(--hover-darken), black);
    --head-sort-cell-border-hover: color-mix(in srgb, var(--head-sort-cell-border) var(--hover-darken), black);

    --body-cell: var(--base-white);
    --body-cell-border: color-mix(in srgb, var(--base-white) var(--border-darken), black);
    --body-cell-hover: color-mix(in srgb, var(--body-cell) var(--hover-darken), black);
    --body-cell-hover-border: color-mix(in srgb, var(--body-cell-border) var(--hover-darken), black);

    --body-cell-sort: var(--body-cell-hover);
    --body-cell-sort-border: var(--body-cell-hover-border);
    --body-cell-sort-hover: color-mix(in srgb, var(--body-cell-sort) var(--hover-darken), black);
    --body-cell-sort-hover-border: color-mix(in srgb, var(--body-cell-sort-border) var(--hover-darken), black);

    --body-cell-expanded: color-mix(in srgb, var(--body-cell) var(--sort-darken), black);
    --body-cell-expanded-border: color-mix(in srgb, var(--body-cell-border) var(--sort-darken), black);
    --body-cell-expanded-hover: color-mix(in srgb, var(--body-cell-expanded) var(--hover-darken), black);
    --body-cell-expanded-hover-border: color-mix(in srgb, var(--body-cell-expanded-border) var(--hover-darken), black);

    --body-cell-expanded-sort: var(--body-cell-expanded-hover);
    --body-cell-expanded-sort-border: var(--body-cell-expanded-hover-border);
    --body-cell-expanded-sort-hover: color-mix(in srgb, var(--body-cell-expanded-sort) var(--hover-darken), black);
    --body-cell-expanded-sort-hover-border: color-mix(in srgb, var(--body-cell-expanded-sort-border) var(--hover-darken), black);
}

.ant-table-wrapper table {
    border-collapse: separate;
}

.ant-table-wrapper .ant-table-thead > tr > th {
    background: var(--head-cell) !important;
    border: 1px solid var(--head-cell-border) !important;
}

.ant-table-wrapper .ant-table-thead > tr > th:hover {
    background: var(--head-cell-hover) !important;
    border: 1px solid var(--head-cell-border-hover) !important;
}

.ant-table-wrapper .ant-table-thead th.ant-table-column-sort {
    background: var(--head-sort-cell) !important;
    border: 1px solid var(--head-sort-cell-border) !important;
}

.ant-table-wrapper .ant-table-thead th.ant-table-column-sort:hover {
    background: var(--head-sort-cell-hover) !important;
    border: 1px solid var(--head-sort-cell-border-hover) !important;
}

.ant-table-wrapper tr {
    background: var(--body-cell) !important;
    transition: all 0.2s ease;
}

.ant-table-wrapper tr td {
    border: 1px solid var(--body-cell-border) !important;
}

.ant-table-wrapper tr:hover {
    background: var(--body-cell-hover) !important;
}

.ant-table-wrapper tr:hover td {
    border: 1px solid var(--body-cell-hover-border) !important;
}

.ant-table-wrapper tr.expanded-row {
    background: var(--body-cell-expanded) !important;
}

.ant-table-wrapper tr.expanded-row:hover {
    background: var(--body-cell-expanded-hover) !important;
}

.ant-table-row td.ant-table-column-sort {
    background: var(--body-cell-sort) !important;
    border: 1px solid var(--body-cell-sort-border) !important;
}

.ant-table-row:hover td.ant-table-column-sort {
    background: var(--body-cell-sort-hover) !important;
    border: 1px solid var(--body-cell-sort-hover-border) !important;
}

.ant-table-wrapper tr.expanded-row td {
    border: 1px solid var(--body-cell-expanded-border) !important;
}

.ant-table-wrapper tr.expanded-row:hover td {
    border: 1px solid var(--body-cell-expanded-sort-hover-border) !important;
}

.ant-table-row.expanded-row .ant-table-column-sort {
    background: var(--body-cell-expanded-sort) !important;
    border: 1px solid var(--body-cell-expanded-sort-border) !important;
}

.ant-table-row.expanded-row:hover .ant-table-column-sort {
    background: var(--body-cell-expanded-sort-hover) !important;
    border: 1px solid var(--body-cell-expanded-sort-hover-border) !important;
}

.ant-table-wrapper tr.expanded-row td:first-of-type {
    border-inline-start: 4px solid rgb(54 132 196) !important;
}
`

type ChatbotQuestionsProps = {
  params: Promise<{ cid: string }>
}

export default function ChatbotQuestions(
  props: ChatbotQuestionsProps,
): ReactElement {
  const params = use(props.params)
  const courseId = Number(params.cid)
  const { userInfo } = useUserInfo()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editingRecord, setEditingRecord] = useState<QuestionListItem>()
  const [upsertModalOpen, setUpsertModalOpen] = useState(false)

  const [questions, setQuestions] = useState<QuestionListItem[]>([])
  const [dataLoading, setDataLoading] = useState(false)

  // choosing to manually control which antd table rows are expanded so that we can expand all children conversations when they click "show conversations"
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([])
  const handleRowExpand = (record: QuestionListItem) => {
    let keys = [...expandedRowKeys]
    const parentKey = record.key
    const childKeys = record.children
      ? record.children.map((child: QuestionListItem) => child.key)
      : []
    if (keys.includes(parentKey)) {
      // already expanded, so collapse parent and remove its children
      keys = keys.filter((key) => key !== parentKey && !childKeys.includes(key))
    } else {
      // expand parent and add children keys too.
      keys.push(parentKey, ...childKeys)
    }
    setExpandedRowKeys(keys)
  }

  const filteredQuestions = useMemo(() => {
    if (!search) {
      return questions
    }
    return questions.filter((question) => {
      return (
        question.chatbotQuestion.question
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        question.chatbotQuestion.answer
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        question.children?.some(
          (q) =>
            q.chatbotQuestion.question
              .toLowerCase()
              .includes(search.toLowerCase()) ||
            q.chatbotQuestion.answer
              .toLowerCase()
              .includes(search.toLowerCase()),
        )
      )
    })
  }, [search, questions])

  const columns: any[] = [
    {
      title: 'Question',
      dataIndex: ['chatbotQuestion', 'question'],
      key: 'question',
      sorter: (a: QuestionListItem, b: QuestionListItem) => {
        const A = a.chatbotQuestion.question || ''
        const B = b.chatbotQuestion.question || ''
        return A.localeCompare(B)
      },
      render: (text: string) => (
        <ExpandableText maxRows={3}>
          {/*
              In some environments, components which return Promises or arrays do not work.
              This is due to some changes to react and @types/react, and the component
              packages have not been updated to fix these issues.
            */}
          {/* @ts-expect-error Server Component */}
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
      dataIndex: ['chatbotQuestion', 'answer'],
      key: 'answer',
      width: 600,
      sorter: (a: QuestionListItem, b: QuestionListItem) => {
        const A = a.chatbotQuestion.answer || ''
        const B = b.chatbotQuestion.answer || ''
        return A.localeCompare(B)
      },
      render: (text: string) => {
        const { thinkText, cleanAnswer } = parseThinkBlock(text ?? '')
        return (
          <ExpandableText maxRows={3}>
            {thinkText && (
              <Tooltip
                title={`AI Thoughts: ${thinkText}`}
                classNames={{
                  body: 'w-96 max-h-[80vh] overflow-y-auto',
                }}
              >
                <span
                  className="mr-1 rounded-lg bg-blue-100 p-0.5 pl-1 text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <i>Thoughts</i> 🧠
                </span>
              </Tooltip>
            )}
            {/*
              In some environments, components which return Promises or arrays do not work.
              This is due to some changes to react and @types/react, and the component
              packages have not been updated to fix these issues.
            */}
            {/* @ts-expect-error Server Component */}
            <Highlighter
              highlightStyle={{ backgroundColor: '#ffc069', padding: 0 }}
              searchWords={[search]}
              autoEscape
              textToHighlight={
                thinkText ? cleanAnswer : text ? text.toString() : ''
              }
            />
          </ExpandableText>
        )
      },
    },
    {
      title: 'Document Citations',
      dataIndex: ['chatbotQuestion', 'citations'],
      key: 'citations',
      onCell: (record: any) => {
        return {
          className:
            record.chatbotQuestion?.citations?.length > 0
              ? '[&:not(th)]:p-0 [&:not(th)]:flex [&:not(th)]:flex-col [&:not(th)]:items-start'
              : undefined,
        }
      },
      render: (citations: ChatbotCitationResponse[]) => {
        return citations?.length > 0 ? (
          <Collapse
            bordered={false}
            className={'min-w-48 max-w-48'}
            items={[
              {
                key: 'citations',
                label: `View Citations`,
                children: <CitationList citations={citations} />,
              },
            ]}
          />
        ) : (
          <div className={'flex h-full w-full flex-grow p-2 text-center'}>
            <p>No Citations</p>
          </div>
        )
      },
    },
    {
      title: 'Verified',
      dataIndex: ['chatbotQuestion', 'verified'],
      key: 'verified',
      sorter: (a: QuestionListItem, b: QuestionListItem) => {
        const A = a.chatbotQuestion.verified ? 1 : 0
        const B = b.chatbotQuestion.verified ? 1 : 0
        return B - A
      },
      filters: [
        { text: 'Verified', value: true },
        { text: 'Unverified', value: false },
      ],
      onFilter: (value: boolean, record: QuestionListItem) =>
        record.chatbotQuestion.verified === value || record.isChild,
      render: (verified: boolean) => (
        <Tooltip
          title={
            verified
              ? 'This question is marked as verified by a human and will appear as such to students that ask this question'
              : 'This question is not marked as verified. Marking it as verified will make it appear as such to students that ask this question. To modify this, you can click the edit button to the right'
          }
        >
          <span
            className={`rounded px-2 py-1 ${verified ? 'bg-green-100' : 'bg-red-100'}`}
          >
            {verified ? 'Verified' : 'Unverified'}
          </span>
        </Tooltip>
      ),
    },
    {
      // the dash was put there so that it would line-break (horizontal space is really valuable for this table)
      title: 'Sugg-ested',
      dataIndex: ['chatbotQuestion', 'suggested'],
      key: 'suggested',
      sorter: (a: QuestionListItem, b: QuestionListItem) => {
        const A = a.chatbotQuestion.suggested ? 1 : 0
        const B = b.chatbotQuestion.suggested ? 1 : 0
        return B - A
      },
      filters: [
        { text: 'Suggested', value: true },
        { text: 'Not Suggested', value: false },
      ],
      onFilter: (value: boolean, record: QuestionListItem) =>
        record.chatbotQuestion.suggested === value || record.isChild,
      render: (suggested: boolean) => (
        <Tooltip
          title={
            suggested
              ? 'This question is marked as suggested and will appear when users start new conversations with the chatbot'
              : 'This question is not marked as suggested. Marking it as suggested will make it appear when users start a new conversation with the chatbot. To modify this, you can click the edit button to the right'
          }
        >
          <span
            className={`rounded px-2 py-1 ${suggested ? 'bg-green-100' : 'bg-red-100'}`}
          >
            {suggested ? 'Yes' : 'No'}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Times Asked',
      dataIndex: 'timesAsked',
      key: 'timesAsked',
      width: 50,
      sorter: (a: QuestionListItem, b: QuestionListItem) => {
        const A = a.timesAsked ?? 0
        const B = b.timesAsked ?? 0
        return A - B
      },
    },
    {
      title: 'User Score',
      dataIndex: ['chatbotQuestion', 'userScore'],
      key: 'userScore',
      width: 50,
      sorter: (a: QuestionListItem, b: QuestionListItem) => {
        const A = a.userScore ?? 0
        const B = b.userScore ?? 0
        return A - B
      },
      render: (userScore?: number | null) =>
        userScore && userScore !== 0 ? (
          <Tooltip
            title={
              userScore > 0
                ? `${userScore} user${userScore > 1 ? 's' : ''} who have asked this question gave it a thumbs up`
                : `${-userScore} user${-userScore > 1 ? 's' : ''} who have asked this question gave it a thumbs down`
            }
          >
            <span
              className={`rounded px-2 py-1 ${
                userScore > 0
                  ? `bg-green-${100 * Math.min(Math.ceil(userScore / 2), 8)}`
                  : `bg-red-${100 * Math.min(Math.ceil(-userScore / 2), 8)}`
              }`}
            >
              {userScore > 0 ? (
                userScore === 1 ? (
                  <ThumbsUp
                    size={16}
                    className="mb-1 inline"
                    color="#000000"
                    fill="#61da81"
                  />
                ) : (
                  <>
                    {userScore}
                    <ThumbsUp
                      size={16}
                      className="mb-1 ml-1 inline"
                      color="#000000"
                      fill="#61da81"
                    />
                  </>
                )
              ) : userScore === -1 ? (
                <ThumbsDown
                  size={16}
                  className="mb-1 inline"
                  color="#000000"
                  fill="#e06666"
                />
              ) : (
                <>
                  {userScore}
                  <ThumbsDown
                    size={16}
                    className="mb-1 ml-1 inline"
                    color="#000000"
                    fill="#e06666"
                  />
                </>
              )}
            </span>
          </Tooltip>
        ) : null,
    },
    {
      title: 'Last Asked',
      dataIndex: 'timestamp',
      key: 'createdAt',
      defaultSortOrder: 'descend',
      width: 90,
      className: '',
      sorter: (a: QuestionListItem, b: QuestionListItem) => {
        a.timestamp =
          a.timestamp != undefined ? new Date(a.timestamp) : undefined
        b.timestamp =
          b.timestamp != undefined ? new Date(b.timestamp) : undefined
        const A = !a.isChild ? (a.timestamp?.getTime() ?? 0) : 0
        const B = !b.isChild ? (b.timestamp?.getTime() ?? 0) : 0
        return A - B
      },
      render: (createdAt: Date) => formatDateAndTimeForExcel(createdAt),
    },
    {
      key: 'actions',
      width: 50,
      render: (_: any, record: QuestionListItem) => (
        <div className="flex flex-col items-center justify-center gap-2">
          <Button
            onClick={() => showEditModal(record)}
            icon={<EditOutlined />}
          />
        </div>
      ),
    },
  ]

  const showEditModal = (record: QuestionListItem) => {
    setEditingRecord(record)
    setUpsertModalOpen(true)
  }

  const getQuestions = useCallback(async () => {
    setDataLoading(true)
    try {
      const questions =
        await API.chatbot.staffOnly.getInteractionsAndQuestions(courseId)

      function applyKey(question: QuestionListItem, base: string = '') {
        question.key =
          question.id >= 0
            ? `${base}${question.id}`
            : `${base}${question.vectorStoreId}`
        if (question.children && question.children.length > 0) {
          question.children.forEach((c) => applyKey(c, `${question.key}-`))
        }
      }
      ;(questions as any[]).forEach((q) => applyKey(q))

      setQuestions(questions as QuestionListItem[])
    } catch (e) {
      const errorMessage = getErrorMessage(e)
      message.error('Failed to fetch questions: ' + errorMessage)
    }
    setDataLoading(false)
  }, [courseId])

  useEffect(() => {
    getQuestions()
  }, [editingRecord, getQuestions])

  const deleteQuestion = async (questionId: string) => {
    await API.chatbot.staffOnly
      .deleteQuestion(courseId, questionId)
      .then(() => {
        getQuestions()
        message.success('Question successfully deleted')
      })
      .catch((e) => {
        message.error('Failed to delete question: ' + getErrorMessage(e))
      })
  }

  return (
    <div className="md:mr-2">
      <style>{overrides}</style>
      <title>{`HelpMe | Editing ${userInfo.courses.find((e) => e.course.id === courseId)?.course.name ?? ''} Chatbot Questions`}</title>
      {/* Tailwind color classes used (this will ensure the tailwind parser sees these classes being used and doesn't remove them): 
          bg-green-100 bg-green-200 bg-green-300 bg-green-400 bg-green-500 bg-green-600 bg-green-700 bg-green-800
          bg-red-100 bg-red-200 bg-red-300 bg-red-400 bg-red-500 bg-red-600 bg-red-700 bg-red-800
      */}
      <UpsertChatbotQuestionModal
        open={upsertModalOpen}
        courseId={courseId}
        editingRecord={editingRecord}
        onCancel={() => {
          setUpsertModalOpen(false)
          setEditingRecord(undefined)
        }}
        deleteQuestion={deleteQuestion}
        onUpsert={() => {
          setUpsertModalOpen(false)
        }}
      />
      <div className="flex w-full items-center justify-between">
        <div className="flex-1">
          <h3 className="m-0 p-0 text-4xl font-bold text-gray-900">
            View Chatbot Questions
          </h3>
          <h4 className="text-[16px] font-medium text-gray-600">
            View and manage the questions being asked of your chatbot
          </h4>
        </div>
        <div className="flex flex-grow flex-col items-center gap-2 md:flex-row">
          <ChatbotHelpTooltip forPage="edit_chatbot_questions" />
          <Input
            className="flex-1"
            placeholder={'Search question or answer...'}
            value={search}
            onChange={(e) => {
              e.preventDefault()
              setSearch(e.target.value)
            }}
            onPressEnter={getQuestions}
          />
          <Button
            icon={<PlusCircleOutlined />}
            onClick={() => {
              setUpsertModalOpen(true)
              setEditingRecord(undefined)
            }}
          >
            Add Question
          </Button>
        </div>
      </div>
      <Divider className="my-3" />
      <Table<QuestionListItem>
        columns={columns}
        bordered
        size="small"
        pagination={{
          current: page,
          total: filteredQuestions.length,
          pageSize: 10,
          onChange: (page) => {
            setPage(page)
          },
          showSizeChanger: false,
        }}
        dataSource={filteredQuestions}
        loading={filteredQuestions.length === 0 && dataLoading}
        rowHoverable={false}
        expandable={{
          expandedRowKeys: expandedRowKeys,
          expandedRowClassName: 'expanded-row',
          expandIcon: ({ expanded, record }) =>
            !record.children ? null : !record.children[0].children ? (
              expanded ? (
                <button
                  className=" ant-table-row-expand-icon ant-table-row-expand-icon-expanded bg-sky-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRowExpand(record)
                  }}
                  aria-expanded="true"
                />
              ) : (
                <Tooltip title="Show the full conversation the student had">
                  <button
                    className="ant-table-row-expand-icon ant-table-row-expand-icon-collapsed bg-sky-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRowExpand(record)
                    }}
                    aria-expanded="false"
                  />
                </Tooltip>
              )
            ) : expanded ? (
              <button
                className="ant-table-row-expand-icon ant-table-row-expand-icon-expanded bg-sky-200"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRowExpand(record)
                }}
                aria-expanded="true"
              />
            ) : (
              <Tooltip title="Show all conversations of 2 or more messages that have this question">
                <button
                  className="ant-table-row-expand-icon ant-table-row-expand-icon-collapsed bg-sky-200"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRowExpand(record)
                  }}
                  aria-expanded="false"
                />
              </Tooltip>
            ),
        }}
      />
    </div>
  )
}

const CitationList: React.FC<{
  citations: ChatbotCitationResponse[]
}> = ({ citations }) => {
  const documents = useMemo(
    () =>
      citations
        .map((v) => v.document)
        .filter((d) => d != undefined) as ChatbotDocumentResponse[],
    [citations],
  )
  const [pageSize] = useState(3)
  const [page, setPage] = useState(1)
  const inDocumentListForm = useMemo(
    () => mapChatbotDocumentsToListForm(documents),
    [documents],
  )
  const numPages = useMemo(
    () => Math.ceil(inDocumentListForm.length / pageSize),
    [inDocumentListForm, pageSize],
  )

  const contentWordMap = useMemo(() => {
    const rec: Record<string, string[]> = {}
    documents.forEach((d) => (rec[d.id] = extractWords(d.content)))
    return rec
  }, [documents])

  const paginatedDocuments = useMemo(
    () => inDocumentListForm.slice((page - 1) * pageSize, page * pageSize),
    [inDocumentListForm, page, pageSize],
  )

  return (
    <>
      <List<ChatbotDocumentListResponse>
        dataSource={paginatedDocuments}
        pagination={false}
        renderItem={(citation: ChatbotDocumentListResponse) => (
          <ChatbotListDocumentItem
            listDocument={citation}
            contentWordMap={contentWordMap}
            mode={'column'}
            size={'small'}
            pageSize={5}
          />
        )}
      />
      <CustomPagination page={page} numPages={numPages} onChange={setPage} />
    </>
  )
}
