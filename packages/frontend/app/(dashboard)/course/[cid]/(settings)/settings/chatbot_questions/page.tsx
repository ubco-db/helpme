'use client'

import { Button, Divider, Input, message, Table } from 'antd'
import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react'
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
  ChatbotQuestionResponse,
  GetInteractionsAndQuestionsResponse,
} from '@koh/common' // CAREFUL this is the one returned from backend. Not to be confused with ChatbotQuestionFrontend

interface Loc {
  pageNumber: number
}

export interface SourceDocument {
  id?: string
  metadata?: {
    loc?: Loc
    name: string
    type?: string
    source?: string
    courseId?: string
  }
  type?: string
  // TODO: is it content or pageContent? since this file uses both. EDIT: It seems to be both/either. Gross.
  content?: string
  pageContent: string
  docName: string
  docId?: string // no idea if this exists in the actual data EDIT: yes it does, sometimes
  pageNumbers?: number[] // same with this, but this might only be for the edit question modal
  pageNumbersString?: string // used only for the edit question modal
  sourceLink?: string
  pageNumber?: number
}

interface IncomingQuestionData {
  id: string
  pageContent: string // this is the question
  metadata: {
    answer: string
    timestamp?: string // i found a chatbot question without a timestamp 😭
    courseId: string
    verified: boolean
    sourceDocuments: SourceDocument[]
    suggested: boolean
    inserted?: boolean
  }
  askedAtLeastOnce?: boolean
}

export interface ChatbotQuestionFrontend {
  key: string
  vectorStoreId: string
  helpMeId?: number
  question: string
  answer: string
  verified?: boolean
  sourceDocuments: SourceDocument[]
  suggested: boolean
  inserted?: boolean
  createdAt: Date | null
  timesAsked?: number | null
  children?: ChatbotQuestionFrontend[] // this is needed by antd table for grouping interactions.
  isChild?: boolean
}

type ChatbotQuestionResponsePlusABit = ChatbotQuestionResponse & {
  correspondingChatbotQuestion?: IncomingQuestionData
  timesAsked?: number
}

type ChatbotQuestionsProps = {
  params: { cid: string }
}

export default function ChatbotQuestions({
  params,
}: ChatbotQuestionsProps): ReactElement {
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

  const filteredQuestions = useMemo(() => {
    if (!search) {
      return questions
    }
    return questions.filter((question) => {
      return (
        question.question.toLowerCase().includes(search.toLowerCase()) ||
        question.children?.some((q) =>
          q.question.toLowerCase().includes(search.toLowerCase()),
        )
      )
    })
  }, [search, questions])

  useEffect(() => {
    fetch(`/chat/${courseId}/aggregateDocuments`, {
      headers: { HMS_API_TOKEN: userInfo.chat_token.token },
    })
      .then((res) => res.json())
      .then((json) => {
        // Convert the json to the expected format
        const formattedDocuments = json.map((doc: SourceDocument) => ({
          docId: doc.id,
          docName: doc.pageContent,
          sourceLink: doc.metadata?.source || '', // Handle the optional source field
          pageNumbers: doc.metadata?.loc ? [doc.metadata.loc.pageNumber] : [], // Handle the optional loc field
        }))
        setExistingDocuments(formattedDocuments)
      })
  }, [userInfo.chat_token.token, courseId])

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
      render: (text: string) => (
        <ExpandableText maxRows={3}>{text}</ExpandableText>
      ),
    },
    {
      title: 'Source Documents',
      dataIndex: 'sourceDocuments',
      key: 'sourceDocuments',
      render: (sourceDocuments: SourceDocument[]) => {
        return (
          <ExpandableText maxRows={3}>
            <div className="flex flex-col gap-1">
              {sourceDocuments.map((doc, index) => (
                <div
                  className="flex w-fit max-w-[280px] flex-col overflow-hidden rounded-xl bg-slate-100 p-2"
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
                  <div className="mt-1 flex  gap-1 text-xs">
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
        { text: 'Not Verified', value: false },
      ],
      onFilter: (value: boolean, record: ChatbotQuestionFrontend) =>
        record.verified === value || record.isChild,
      render: (verified: boolean) => (
        <span
          className={`rounded px-2 py-1 ${verified ? 'bg-green-100' : 'bg-red-100'}`}
        >
          {verified ? 'Verified' : 'Unverified'}
        </span>
      ),
    },
    {
      title: 'Suggested',
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
        <span
          className={`rounded px-2 py-1 ${suggested ? 'bg-green-100' : 'bg-red-100'}`}
        >
          {suggested ? 'Yes' : 'No'}
        </span>
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
      title: 'Last Asked',
      dataIndex: 'createdAt',
      key: 'createdAt',
      defaultSortOrder: 'descend',
      width: 90,
      sorter: (a: ChatbotQuestionFrontend, b: ChatbotQuestionFrontend) => {
        const A = a.createdAt ? a.createdAt.getTime() : 0
        const B = b.createdAt ? b.createdAt.getTime() : 0
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
    // the helpme database stores interactions and has duplicate questions
    // the chatbot database stores .sourceDocuments and .verified and .inserted (AND is the only one updated when a question is edited AND is where added questions from AddChatbotQuestionModal go)
    // we need to fetch both and merge them
    // this becomes a really hard problem especially if you consider how the first question in an interaction can be a duplicate but subsequent questions can be different
    try {
      // Fire off both requests simultaneously.
      const [interactions, allQuestionsResponse] = await Promise.all([
        API.chatbot.getInteractionsAndQuestions(courseId), // helpme questions
        fetch(`/chat/${courseId}/allQuestions`, {
          // chatbot questions
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            HMS_API_TOKEN: userInfo.chat_token.token,
          },
        }),
      ])

      // Check that the second response is ok.
      if (!allQuestionsResponse.ok) {
        const errorMessage = getErrorMessage(allQuestionsResponse)
        throw new Error(errorMessage)
      }

      const allQuestionsData: IncomingQuestionData[] =
        await allQuestionsResponse.json()

      const processedQuestions = processQuestions(
        interactions,
        allQuestionsData,
      )

      setQuestions(processedQuestions)
    } catch (e) {
      const errorMessage = getErrorMessage(e)
      message.error('Failed to fetch questions: ' + errorMessage)
    }
    setDataLoading(false)
  }, [courseId, userInfo.chat_token.token])

  useEffect(() => {
    getQuestions()
  }, [editingRecord, getQuestions])

  console.log('filteredQuesitons', filteredQuestions)

  const deleteQuestion = async (questionId: string) => {
    try {
      await fetch(`/chat/${courseId}/question/${questionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          HMS_API_TOKEN: userInfo.chat_token.token,
        },
      })

      getQuestions()
      message.success('Question successfully deleted')
    } catch (e) {
      message.error('Failed to delete question.')
    }
  }

  return (
    <div className="md:mr-2">
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
          profile={userInfo}
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
        <Input
          className="flex-1"
          placeholder={'Search question...'}
          value={search}
          onChange={(e) => {
            e.preventDefault()
            setSearch(e.target.value)
          }}
          onPressEnter={getQuestions}
        />
        <Button className="m-2" onClick={() => setAddModelOpen(true)}>
          Add Question
        </Button>
      </div>
      <Divider className="my-3" />
      <Table
        columns={columns}
        bordered
        size="small"
        dataSource={filteredQuestions}
        loading={filteredQuestions.length === 0 && dataLoading}
      />
    </div>
  )
}

function mergeChatbotQuestions(
  helpMeQuestion: ChatbotQuestionResponse | null,
  chatbotQuestion: IncomingQuestionData | null,
  timesAsked?: number | null,
  children?: ChatbotQuestionFrontend[],
  isChild?: boolean,
): ChatbotQuestionFrontend {
  return {
    key:
      (helpMeQuestion?.vectorStoreId ?? '') +
      helpMeQuestion?.id.toString() +
      (children && children.length > 0 ? children[0].key : ''),
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
    timesAsked,
    children,
    isChild,
  }
}

function processQuestions(
  interactions: GetInteractionsAndQuestionsResponse,
  allQuestionsData: IncomingQuestionData[],
): ChatbotQuestionFrontend[] {
  // We need to process and merge the questions from chatbot and helpme db (in unfortunately O(n^2) time, since we basically need to manually join each chatbot question with helpme question via vectorStoreId)
  const processedQuestions: ChatbotQuestionFrontend[] = []
  for (const chatbotQuestion of allQuestionsData) {
    // for each chatbot question, find ALL interactions that have this chatbot question
    let timesAsked = 0
    const interactionsWithThisQuestion: GetInteractionsAndQuestionsResponse = []
    let mostRecentlyAskedHelpMeVersion: ChatbotQuestionResponse | null = null
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
            interactionsWithThisQuestion.push(tempInteraction)
            hasAlreadyBeenAdded = true
          }
          if (
            !mostRecentlyAskedHelpMeVersion ||
            mostRecentlyAskedHelpMeVersion.timestamp < helpMeQuestion.timestamp
          ) {
            mostRecentlyAskedHelpMeVersion = helpMeQuestion
          }

          const tempHelpMeQuestion: ChatbotQuestionResponsePlusABit =
            helpMeQuestion
          timesAsked++
          // this will modify the original question object
          tempHelpMeQuestion.correspondingChatbotQuestion = chatbotQuestion // the join
          // tempHelpMeQuestion.timesAsked = timesAsked
        }
      }
    }

    if (interactionsWithThisQuestion.length === 0) {
      // if there was no corresponding interaction found (e.g. it was a manually added question), return what we can
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

    // Now for the children:
    // - if if there are more than 1 interaction for this chatbot question, it will first show the chatbot question and then its children will be all the interactions and their children will be all the questions
    // - if there is only 1 interaction for this chatbot question, it will be the first question and its children will be all the other questions in the interaction
    if (interactionsWithThisQuestion.length > 1) {
      const children = []
      for (const interaction of interactionsWithThisQuestion) {
        // if the interaction is only a single question long, don't add it
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
            ),
          )
        }
        // for each child, they are the first question in an interaction and all of their children are the rest of the questions in the interaction
        children.push(
          mergeChatbotQuestions(
            interaction.questions[0],
            interaction.questions[0].correspondingChatbotQuestion,
            null,
            grandchildren.length > 0 ? grandchildren : undefined,
            true,
          ),
        )
      }
      // finally add on the question and all of its children
      processedQuestions.push(
        mergeChatbotQuestions(
          mostRecentlyAskedHelpMeVersion, // the mostRecentlyAskedHelpMeVersion is just to grab the createdAt date for it
          chatbotQuestion,
          timesAsked,
          children.length > 0 ? children : undefined,
        ),
      )
    } else if (interactionsWithThisQuestion.length === 1) {
      const interaction = interactionsWithThisQuestion[0]
      if (
        !interaction.questions ||
        interaction.questions.length === 0 ||
        interaction.questions[0].vectorStoreId !== chatbotQuestion.id
      ) {
        // don't show the interaction if it doesn't have the chatbot question as the first question
        continue
      }

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
            ),
          )
        }
      }

      // finally add on the question and all of its children
      processedQuestions.push(
        mergeChatbotQuestions(
          interaction.questions[0],
          chatbotQuestion,
          timesAsked,
          children.length > 0 ? children : undefined,
        ),
      )
    }
  }
  return processedQuestions
}
