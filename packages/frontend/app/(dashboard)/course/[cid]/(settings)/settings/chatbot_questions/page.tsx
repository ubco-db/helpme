'use client'

import { Button, Divider, Input, message, Table, Tooltip } from 'antd'
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
import EditChatbotQuestionModal from './components/EditChatbotQuestionModal'
import { EditOutlined } from '@ant-design/icons'
import Highlighter from 'react-highlight-words'
import AddChatbotQuestionModal from './components/AddChatbotQuestionModal'
import { formatDateAndTimeForExcel } from '@/app/utils/timeFormatUtils'
import { API } from '@/app/api'
import {
  ChatbotQuestionResponseChatbotDB,
  ChatbotQuestionResponseHelpMeDB,
  InteractionResponse,
  parseThinkBlock,
  SourceDocument,
} from '@koh/common'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import ChatbotHelpTooltip from '../components/ChatbotHelpTooltip'

export interface ChatbotQuestionFrontend {
  key: string
  vectorStoreId: string
  helpMeId?: number
  question: string
  answer: string
  verified?: boolean
  sourceDocuments: SourceDocument[]
  suggested: boolean
  userScore?: number
  inserted?: boolean
  createdAt: Date | null
  timesAsked?: number | null
  children?: ChatbotQuestionFrontend[] // this is needed by antd table for grouping interactions.
  isChild?: boolean
}

type ChatbotQuestionsProps = {
  params: Promise<{ cid: string }>
}

export default function ChatbotQuestions(
  props: ChatbotQuestionsProps,
): ReactElement {
  const params = use(props.params)
  const courseId = Number(params.cid)
  const [addModelOpen, setAddModelOpen] = useState(false)
  const { userInfo } = useUserInfo()
  const [search, setSearch] = useState('')
  const [editingRecord, setEditingRecord] =
    useState<ChatbotQuestionFrontend | null>(null)
  const [editRecordModalOpen, setEditRecordModalOpen] = useState(false)
  const [questions, setQuestions] = useState<ChatbotQuestionFrontend[]>([])
  const [existingDocuments, setExistingDocuments] = useState<SourceDocument[]>(
    [],
  )
  const [dataLoading, setDataLoading] = useState(false)

  // choosing to manually control which antd table rows are expanded so that we can expand all children conversations when they click "show conversations"
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([])
  const handleRowExpand = (record: ChatbotQuestionFrontend) => {
    let keys = [...expandedRowKeys]
    const parentKey = record.key
    const childKeys = record.children
      ? record.children.map((child) => child.key)
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
        question.question.toLowerCase().includes(search.toLowerCase()) ||
        question.answer.toLowerCase().includes(search.toLowerCase()) ||
        question.children?.some(
          (q) =>
            q.question.toLowerCase().includes(search.toLowerCase()) ||
            q.answer.toLowerCase().includes(search.toLowerCase()),
        )
      )
    })
  }, [search, questions])

  useEffect(() => {
    API.chatbot.staffOnly
      .getAllAggregateDocuments(courseId)
      .then((res) => {
        const formattedDocuments = res.map((doc) => ({
          key: doc.id,
          docId: doc.id,
          docName: doc.pageContent,
          pageContent: doc.pageContent,
          sourceLink: doc.metadata?.source || '',
          pageNumbers: doc.metadata?.loc ? [doc.metadata.loc.pageNumber] : [],
        }))
        setExistingDocuments(formattedDocuments)
      })
      .catch((e) => {
        message.error('Failed to fetch documents: ' + getErrorMessage(e))
      })
  }, [courseId])

  const columns: any[] = [
    {
      title: 'Question',
      dataIndex: 'question',
      key: 'question',
      sorter: (a: ChatbotQuestionFrontend, b: ChatbotQuestionFrontend) => {
        const A = a.question || ''
        const B = b.question || ''
        return A.localeCompare(B)
      },
      render: (text: string) => (
        <ExpandableText maxRows={3}>
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
      dataIndex: 'answer',
      key: 'answer',
      width: 600,
      sorter: (a: ChatbotQuestionFrontend, b: ChatbotQuestionFrontend) => {
        const A = a.answer || ''
        const B = b.answer || ''
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
      dataIndex: 'sourceDocuments',
      key: 'sourceDocuments',
      render: (sourceDocuments: SourceDocument[]) => {
        return (
          <ExpandableText maxRows={3}>
            <div className="flex flex-col gap-1">
              {sourceDocuments.map((doc, index) => (
                <div
                  className="flex w-fit max-w-[260px] flex-col overflow-hidden rounded-xl bg-slate-100 p-2"
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
                  <div className="mt-1 flex gap-1 text-xs">
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
          </ExpandableText>
        )
      },
    },
    {
      title: 'Verified',
      dataIndex: 'verified',
      key: 'verified',
      sorter: (a: ChatbotQuestionFrontend, b: ChatbotQuestionFrontend) => {
        const A = a.verified ? 1 : 0
        const B = b.verified ? 1 : 0
        return B - A
      },
      filters: [
        { text: 'Verified', value: true },
        { text: 'Unverified', value: false },
      ],
      onFilter: (value: boolean, record: ChatbotQuestionFrontend) =>
        record.verified === value || record.isChild,
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
      dataIndex: 'suggested',
      key: 'suggested',
      sorter: (a: ChatbotQuestionFrontend, b: ChatbotQuestionFrontend) => {
        const A = a.suggested ? 1 : 0
        const B = b.suggested ? 1 : 0
        return B - A
      },
      filters: [
        { text: 'Suggested', value: true },
        { text: 'Not Suggested', value: false },
      ],
      onFilter: (value: boolean, record: ChatbotQuestionFrontend) =>
        record.suggested === value || record.isChild,
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
      sorter: (a: ChatbotQuestionFrontend, b: ChatbotQuestionFrontend) => {
        const A = a.timesAsked ?? 0
        const B = b.timesAsked ?? 0
        return A - B
      },
    },
    {
      title: 'User Score',
      dataIndex: 'userScore',
      key: 'userScore',
      width: 50,
      sorter: (a: ChatbotQuestionFrontend, b: ChatbotQuestionFrontend) => {
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
      dataIndex: 'createdAt',
      key: 'createdAt',
      defaultSortOrder: 'descend',
      width: 90,
      sorter: (a: ChatbotQuestionFrontend, b: ChatbotQuestionFrontend) => {
        const A = a.createdAt && !a.isChild ? a.createdAt.getTime() : 0
        const B = b.createdAt && !b.isChild ? b.createdAt.getTime() : 0
        return A - B
      },
      render: (createdAt: Date) => formatDateAndTimeForExcel(createdAt),
    },
    {
      key: 'actions',
      width: 50,
      render: (_: any, record: ChatbotQuestionFrontend) => (
        <div className="flex flex-col items-center justify-center gap-2">
          <Button
            onClick={() => showEditModal(record)}
            icon={<EditOutlined />}
          />
        </div>
      ),
    },
  ]

  const showEditModal = (record: ChatbotQuestionFrontend) => {
    setEditingRecord(record)
    setEditRecordModalOpen(true)
  }

  const getQuestions = useCallback(async () => {
    setDataLoading(true)
    // NOTE
    // We store the chatbot questions in two separate backends for some reason
    // the helpme database stores interactions and has duplicate questions and userScores
    // the chatbot database stores .sourceDocuments and .verified and .inserted (AND is the only one updated when a question is edited AND is where added questions from AddChatbotQuestionModal go)
    // we need to fetch both and merge them
    // this becomes a really hard problem especially if you consider how the first question in an interaction can be a duplicate but subsequent questions can be different
    try {
      const { helpmeDB, chatbotDB } =
        await API.chatbot.staffOnly.getInteractionsAndQuestions(courseId)

      const processedQuestions = processQuestions(helpmeDB, chatbotDB)

      setQuestions(processedQuestions)
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
      <title>{`HelpMe | Editing ${userInfo.courses.find((e) => e.course.id === courseId)?.course.name ?? ''} Chatbot Questions`}</title>
      {/* Tailwind color classes used (this will ensure the tailwind parser sees these classes being used and doesn't remove them): 
          bg-green-100 bg-green-200 bg-green-300 bg-green-400 bg-green-500 bg-green-600 bg-green-700 bg-green-800
          bg-red-100 bg-red-200 bg-red-300 bg-red-400 bg-red-500 bg-red-600 bg-red-700 bg-red-800
      */}
      <AddChatbotQuestionModal
        open={addModelOpen}
        courseId={courseId}
        existingDocuments={existingDocuments}
        onCancel={() => setAddModelOpen(false)}
        onAddSuccess={() => {
          getQuestions()
          setAddModelOpen(false)
        }}
      />
      {editingRecord && (
        <EditChatbotQuestionModal
          open={editRecordModalOpen}
          cid={courseId}
          editingRecord={editingRecord}
          onCancel={() => setEditRecordModalOpen(false)}
          onSuccessfulUpdate={() => {
            getQuestions()
            setEditRecordModalOpen(false)
          }}
          deleteQuestion={deleteQuestion}
        />
      )}
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
          <Button onClick={() => setAddModelOpen(true)}>Add Question</Button>
        </div>
      </div>
      <Divider className="my-3" />
      <Table
        columns={columns}
        bordered
        size="small"
        dataSource={filteredQuestions}
        loading={filteredQuestions.length === 0 && dataLoading}
        expandable={{
          expandedRowKeys: expandedRowKeys,
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
function mergeChatbotQuestions(
  helpMeQuestion?: ChatbotQuestionResponseHelpMeDB | null,
  chatbotQuestion?: ChatbotQuestionResponseChatbotDB | null,
  timesAsked?: number | null,
  children?: ChatbotQuestionFrontend[],
  isChild?: boolean,
  userScore?: number,
): ChatbotQuestionFrontend {
  return {
    // key must be unique for each row in the table (otherwise weird react re-render things happen)
    key:
      (helpMeQuestion?.vectorStoreId ?? '') +
      helpMeQuestion?.id.toString() +
      (children && children.length > 0 ? children[0].key : '') +
      (isChild ? 'child' : ''),
    vectorStoreId: helpMeQuestion?.vectorStoreId ?? '', // should be guaranteed to exist
    helpMeId: helpMeQuestion?.id || -1,
    question:
      chatbotQuestion?.pageContent ?? helpMeQuestion?.questionText ?? 'error', // chatbot database question takes precedence (in general) since when you edit a question, you only edit it on chatbot database
    answer:
      chatbotQuestion?.metadata.answer ??
      helpMeQuestion?.responseText ??
      'error',
    verified: chatbotQuestion?.metadata.verified, // helpme database does not have verified
    sourceDocuments: chatbotQuestion?.metadata.sourceDocuments ?? [], // helpme database does not have sourceDocuments
    suggested:
      chatbotQuestion?.metadata.suggested ?? helpMeQuestion?.suggested ?? false,
    inserted: chatbotQuestion?.metadata.inserted, // helpme database does not have inserted
    createdAt: helpMeQuestion?.timestamp
      ? new Date(
          helpMeQuestion.timestamp, // prioritize the helpme database for this one (since it stores duplicates n stuff)
        )
      : chatbotQuestion?.metadata.timestamp
        ? new Date(chatbotQuestion.metadata.timestamp)
        : null,
    userScore,
    timesAsked,
    children,
    isChild,
  }
}

function processQuestions(
  interactions: InteractionResponse[],
  allQuestionsData: ChatbotQuestionResponseChatbotDB[],
): ChatbotQuestionFrontend[] {
  //
  // The Join
  //
  // We need to process and merge the questions from chatbot and helpme db (in unfortunately O(n^2) time, since we basically need to manually join each chatbot question with helpme question via vectorStoreId)
  // (there are basically 0 to many helpme db questions for each chatbot db question)
  const processedQuestions: ChatbotQuestionFrontend[] = []
  for (const chatbotQuestion of allQuestionsData) {
    // for each chatbot question, find ALL interactions that have this chatbot question
    for (const tempInteraction of interactions) {
      if (
        !tempInteraction.questions ||
        tempInteraction.questions.length === 0
      ) {
        continue
      }

      // cycle through all the questions interactions
      let hasAlreadyBeenAdded = false
      for (const helpMeQuestion of tempInteraction.questions) {
        if (helpMeQuestion.vectorStoreId === chatbotQuestion.id) {
          // a match
          if (!hasAlreadyBeenAdded) {
            // to not add the same interaction multiple times
            if (!chatbotQuestion.interactionsWithThisQuestion) {
              chatbotQuestion.interactionsWithThisQuestion = []
            }
            chatbotQuestion.interactionsWithThisQuestion.push(tempInteraction)
            hasAlreadyBeenAdded = true
          }
          if (
            !chatbotQuestion.mostRecentlyAskedHelpMeVersion ||
            chatbotQuestion.mostRecentlyAskedHelpMeVersion.timestamp <
              helpMeQuestion.timestamp
          ) {
            chatbotQuestion.mostRecentlyAskedHelpMeVersion = helpMeQuestion
          }

          // this will modify the original question object
          chatbotQuestion.timesAsked = (chatbotQuestion.timesAsked ?? 0) + 1
          helpMeQuestion.correspondingChatbotQuestion = chatbotQuestion // the join
          chatbotQuestion.userScoreTotal =
            (chatbotQuestion.userScoreTotal ?? 0) + helpMeQuestion.userScore
        }
      }
    }
  }

  //
  // Formatting the data nicely for the antd table
  //
  // this is something like O(n) time since it's just looping over the processed chatbot questions and all of their interactions
  for (const chatbotQuestion of allQuestionsData) {
    const timesAsked = chatbotQuestion.timesAsked
    const mostRecentlyAskedHelpMeVersion =
      chatbotQuestion.mostRecentlyAskedHelpMeVersion
    const interactionsWithThisQuestion =
      chatbotQuestion.interactionsWithThisQuestion ?? []
    if (interactionsWithThisQuestion.length === 0) {
      // if there was no corresponding interaction found (e.g. it was a manually added question or anytime question), return what we can
      processedQuestions.push({
        key: chatbotQuestion.id,
        vectorStoreId: chatbotQuestion.id,
        question: chatbotQuestion.pageContent,
        answer: chatbotQuestion.metadata.answer,
        verified: chatbotQuestion.metadata.verified,
        sourceDocuments: chatbotQuestion.metadata.sourceDocuments ?? [],
        suggested: chatbotQuestion.metadata.suggested,
        inserted: chatbotQuestion.metadata.inserted,
        createdAt: chatbotQuestion.metadata.timestamp
          ? new Date(chatbotQuestion.metadata.timestamp)
          : null,
        timesAsked,
      })
    }

    // Now for the children (if you give an antd table item a list of children, it will auto-create sub rows for them):
    // - if if there are more than 1 interaction for this chatbot question, it will first show the chatbot question and then its children will be all the interactions (children) and their children will be all the questions (grandchildren)
    // - if there is only 1 interaction for this chatbot question, it will be the first question and its children will be all the other questions in the interaction
    if (interactionsWithThisQuestion.length > 1) {
      const children = []
      for (const interaction of interactionsWithThisQuestion) {
        // if the interaction is only a single question long, don't add it (since the parent table item *is* this question)
        if (!interaction.questions || interaction.questions.length <= 1) {
          continue
        }
        const grandchildren = []
        for (let i = 1; i < interaction.questions.length; i++) {
          const childHelpMeQuestion = interaction.questions[i]
          if (!childHelpMeQuestion) {
            continue
          }

          grandchildren.push(
            mergeChatbotQuestions(
              childHelpMeQuestion,
              childHelpMeQuestion.correspondingChatbotQuestion,
              null, // timesAsked is null since its not really helpful information to show in this case
              undefined,
              true,
              chatbotQuestion !==
                childHelpMeQuestion.correspondingChatbotQuestion
                ? childHelpMeQuestion.correspondingChatbotQuestion
                    ?.userScoreTotal
                : undefined,
            ),
          )
        }
        grandchildren.sort((a, b) => {
          const aTime = a.createdAt?.getTime() ?? 0
          const bTime = b.createdAt?.getTime() ?? 0
          return aTime - bTime // ascending order
        })

        // for each child, they are the first question in an interaction and all of their children are the rest of the questions in the interaction
        children.push(
          mergeChatbotQuestions(
            interaction.questions[0],
            interaction.questions[0].correspondingChatbotQuestion,
            null,
            grandchildren.length > 0 ? grandchildren : undefined,
            true,
            chatbotQuestion !==
              interaction.questions[0].correspondingChatbotQuestion
              ? interaction.questions[0].correspondingChatbotQuestion
                  ?.userScoreTotal
              : undefined,
          ),
        )
      }

      children.sort((a, b) => {
        const aTime = a.createdAt?.getTime() ?? 0
        const bTime = b.createdAt?.getTime() ?? 0
        return bTime - aTime // descending order
      })
      // finally add on the question and all of its children
      processedQuestions.push(
        mergeChatbotQuestions(
          mostRecentlyAskedHelpMeVersion, // the mostRecentlyAskedHelpMeVersion is just to grab the createdAt date for it
          chatbotQuestion,
          timesAsked,
          children.length > 0 ? children : undefined,
          false,
          chatbotQuestion.userScoreTotal,
        ),
      )
    } else if (interactionsWithThisQuestion.length === 1) {
      // now for case if there is only 1 interaction for this chatbot db question
      const interaction = interactionsWithThisQuestion[0]
      if (
        !interaction.questions ||
        interaction.questions.length === 0 ||
        interaction.questions[0].vectorStoreId !== chatbotQuestion.id // don't show the interaction if it doesn't have the chatbot db question as the first question (to avoid duplicates)
      ) {
        continue
      }

      // make the children all the other questions in the interaction
      const children = []
      if (interaction.questions.length > 1) {
        for (let i = 1; i < interaction.questions.length; i++) {
          const childHelpMeQuestion = interaction.questions[i]
          if (!childHelpMeQuestion) {
            continue
          }

          children.push(
            mergeChatbotQuestions(
              childHelpMeQuestion,
              childHelpMeQuestion.correspondingChatbotQuestion,
              null,
              undefined,
              true,
              childHelpMeQuestion.correspondingChatbotQuestion?.userScoreTotal,
            ),
          )
        }
      }
      children.sort((a, b) => {
        const aTime = a.createdAt?.getTime() ?? 0
        const bTime = b.createdAt?.getTime() ?? 0
        return aTime - bTime // ascending order
      })

      // finally add on the question and all of its children
      processedQuestions.push(
        mergeChatbotQuestions(
          interaction.questions[0],
          chatbotQuestion,
          timesAsked,
          children.length > 0 ? children : undefined,
          false,
          chatbotQuestion.userScoreTotal,
        ),
      )
    }
  }
  return processedQuestions
}
