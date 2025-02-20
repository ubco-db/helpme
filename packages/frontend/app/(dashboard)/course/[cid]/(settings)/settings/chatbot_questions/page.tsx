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
import { ChatbotQuestionResponse } from '@koh/common' // CAREFUL this is the one returned from backend. Not to be confused with ChatbotQuestionFrontend

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
    timestamp: string
    courseId: string
    verified: boolean
    sourceDocuments: SourceDocument[]
    suggested: boolean
    inserted?: boolean
  }
}

export interface ChatbotQuestionFrontend {
  vectorStoreId: string
  helpMeId?: number
  question: string
  answer: string
  verified?: boolean
  sourceDocuments: SourceDocument[]
  suggested: boolean
  inserted?: boolean
  createdAt: Date
  timesAsked?: number | null
  children?: ChatbotQuestionFrontend[] // this is needed by antd table for grouping interactions.
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
        record.verified === value,
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
        record.suggested === value,
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
      title: 'Date Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      defaultSortOrder: 'descend',
      width: 90,
      sorter: (a: ChatbotQuestionFrontend, b: ChatbotQuestionFrontend) => {
        const A = a.createdAt.getTime()
        const B = b.createdAt.getTime()
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

      // We need to process and merge the questions from chatbot and helpme db (in unfortunately O(n^2) time, since we basically need to manually join each chatbot question with helpme question via vectorStoreId)
      const processedQuestions: ChatbotQuestionFrontend[] =
        allQuestionsData
          .map((chatbotQuestion) => {
            // for each chatbot question, find corresponding interaction that has the chatbot question (the interaction's question must not have isPreviousQuestion)
            let interaction = null
            let timesAsked = 0
            for (const tempInteraction of interactions) {
              // the first interaction whose first question has the right id (and is not a previous question) becomes 'interaction'
              // once the interaction is found, continue cycling through all the questions to count up timesAsked
              if (
                !tempInteraction.questions ||
                tempInteraction.questions.length === 0
              ) {
                continue
              }
              if (
                !interaction && // don't overwrite interaction if it's already set
                tempInteraction.questions[0].vectorStoreId ===
                  chatbotQuestion.id &&
                !tempInteraction.questions[0].isPreviousQuestion
              ) {
                interaction = tempInteraction
              }
              // cycle through all the questions interactions
              for (const question of tempInteraction.questions) {
                if (question.vectorStoreId === chatbotQuestion.id) {
                  const tempQuestion: ChatbotQuestionResponsePlusABit = question
                  timesAsked++
                  // this will modify the original question object
                  tempQuestion.correspondingChatbotQuestion = chatbotQuestion // the join
                  tempQuestion.timesAsked = timesAsked
                }
              }
            }
            if (!interaction || !interaction.questions) {
              // if there was no corresponding interaction found (e.g. it was a manually added question), return what we can
              return {
                vectorStoreId: chatbotQuestion.id,
                question: chatbotQuestion.pageContent,
                answer: chatbotQuestion.metadata.answer,
                verified: chatbotQuestion.metadata.verified,
                sourceDocuments: chatbotQuestion.metadata.sourceDocuments ?? [],
                suggested: chatbotQuestion.metadata.suggested,
                inserted: chatbotQuestion.metadata.inserted,
                createdAt: new Date(chatbotQuestion.metadata.timestamp),
                timesAsked,
              }
            }

            // add on any children (loop through the rest of the questions in each interaction and then add them as children to the first question)
            const children = []
            if (interaction.questions.length > 1) {
              for (let i = 1; i < interaction.questions.length; i++) {
                // this is probably like the only traditional for loop in the whole system lmao (I want to start from index 1)
                const childHelpMeQuestion = interaction.questions[i]
                if (!childHelpMeQuestion) {
                  return null
                }

                children.push(
                  mergeChatbotQuestions(
                    childHelpMeQuestion,
                    childHelpMeQuestion.correspondingChatbotQuestion,
                    childHelpMeQuestion.timesAsked,
                  ),
                ) // timesAsked is null since there is no way it can be greater than 1
              }
            }

            // finally add on the question and all of its children
            return mergeChatbotQuestions(
              interaction.questions[0],
              chatbotQuestion,
              timesAsked,
              children.length > 0 ? children : undefined,
            )
          })
          .filter((chatbotQuestion) => chatbotQuestion != null) || [] // since .map must return an array of the same length, doing .filter will remove the nulled entries

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

  console.log(filteredQuestions)

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
  helpMeQuestion: ChatbotQuestionResponse,
  chatbotQuestion: IncomingQuestionData | null,
  timesAsked?: number | null,
  children?: ChatbotQuestionFrontend[],
): ChatbotQuestionFrontend {
  return {
    vectorStoreId: helpMeQuestion.vectorStoreId ?? '', // should be guaranteed to exist
    helpMeId: helpMeQuestion.id,
    question: chatbotQuestion?.pageContent ?? helpMeQuestion.questionText, // chatbot database question takes precedence (in general) since when you edit a question, you only edit it on chatbot database
    answer: chatbotQuestion?.metadata.answer ?? helpMeQuestion.responseText,
    verified: chatbotQuestion?.metadata.verified, // helpme database does not have verified
    sourceDocuments: chatbotQuestion?.metadata.sourceDocuments ?? [], // helpme database does not have sourceDocuments
    suggested: chatbotQuestion?.metadata.suggested ?? helpMeQuestion.suggested,
    inserted: chatbotQuestion?.metadata.inserted, // helpme database does not have inserted
    createdAt: new Date(
      chatbotQuestion?.metadata.timestamp ?? helpMeQuestion.timestamp,
    ),
    timesAsked,
    children,
  }
}
