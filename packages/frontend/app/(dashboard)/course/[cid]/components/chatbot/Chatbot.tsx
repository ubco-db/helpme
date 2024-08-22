'use client'
import { useEffect, useState, useRef, ReactElement, Fragment } from 'react'
import {
  Input,
  Button,
  Card,
  Avatar,
  Spin,
  Tooltip,
  message,
  Space,
} from 'antd'
import {
  CheckCircleOutlined,
  UserOutlined,
  RobotOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import axios from 'axios'
import { useCourseFeatures } from '@/app/hooks/useCourseFeatures'
import { useUserInfo } from '@/app/contexts/userContext'
import { cn } from '@/app/utils/generalUtils'

const { TextArea } = Input

export interface SourceDocument {
  docName: string
  sourceLink: string
  pageNumbers: number[]
  metadata?: { type?: string }
  type?: string
  content?: string
}

// TODO: Update this type so it's actually accurate.
// It was previously just question: string, and answer: string. I added some new types, please fix it if it's incorrect
export interface PreDeterminedQuestion {
  question?: string
  answer?: string
  pageContent?: any
  metadata?: {
    verified: boolean
    sourceDocuments: SourceDocument[]
    answer: string
  }
}

export interface Message {
  type: 'apiMessage' | 'userMessage'
  message: string | void
  verified?: boolean
  sourceDocuments?: SourceDocument[]
  questionId?: number
}
interface ChatbotProps {
  cid: number
  variant?: 'small' | 'big' | 'huge'
  preDeterminedQuestions: PreDeterminedQuestion[]
  setPreDeterminedQuestions: React.Dispatch<
    React.SetStateAction<PreDeterminedQuestion[]>
  >
  questionsLeft: number
  setQuestionsLeft: React.Dispatch<React.SetStateAction<number>>
  messages: Message[]
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  isOpen: boolean
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>
}

const Chatbot: React.FC<ChatbotProps> = ({
  cid,
  variant = 'small',
  preDeterminedQuestions,
  setPreDeterminedQuestions,
  questionsLeft,
  setQuestionsLeft,
  messages,
  setMessages,
  isOpen,
  setIsOpen,
}): ReactElement => {
  const [input, setInput] = useState('')
  const { userInfo, setUserInfo } = useUserInfo()
  const [isLoading, setIsLoading] = useState(false)
  const [_interactionId, setInteractionId] = useState<number | null>(null)
  const courseFeatures = useCourseFeatures(cid)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasAskedQuestion = useRef(false) // to track if the user has asked a question

  useEffect(() => {
    if (messages.length === 1) {
      setPreDeterminedQuestions([])
      axios
        .get(`/chat/${cid}/allSuggestedQuestions`, {
          headers: { HMS_API_TOKEN: userInfo.chat_token?.token },
        })
        .then((res) => {
          res.data.forEach((question: PreDeterminedQuestion) => {
            setPreDeterminedQuestions((prev: PreDeterminedQuestion[]) => {
              return [
                ...prev,
                {
                  question: question.pageContent,
                  answer: question.metadata?.answer,
                  sourceDocuments: question.metadata?.sourceDocuments,
                  verified: question.metadata?.verified,
                },
              ]
            })
          })
        })
        .catch((err) => {
          console.error(err)
        })
    }
    if (userInfo.chat_token) {
      setQuestionsLeft(userInfo.chat_token.max_uses - userInfo.chat_token.used)
    }
    return () => {
      setInteractionId(null)
    }
  }, [
    userInfo,
    cid,
    setPreDeterminedQuestions,
    messages.length,
    setQuestionsLeft,
  ])

  const query = async () => {
    try {
      const data = {
        question: input,
        history: messages,
      }
      const response = await fetch(`/chat/${cid}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          HMS_API_TOKEN: userInfo.chat_token.token,
        },
        body: JSON.stringify(data),
      })
      const json = await response.json()
      if (questionsLeft > 0) {
        setQuestionsLeft(questionsLeft - 1)
        setUserInfo({
          ...userInfo,
          chat_token: {
            ...userInfo.chat_token,
            used: userInfo.chat_token.used + 1,
          },
        })
      }
      return json
    } catch (error) {
      if (questionsLeft > 0) {
        setQuestionsLeft(questionsLeft - 1)
        setUserInfo({
          ...userInfo,
          chat_token: {
            ...userInfo.chat_token,
            used: userInfo.chat_token.used + 1,
          },
        })
      }
      return null
    }
  }

  const handleAsk = async () => {
    if (!hasAskedQuestion.current) {
      hasAskedQuestion.current = true
      setPreDeterminedQuestions([]) // clear predetermined questions upon the first question
    }
    setIsLoading(true)

    const result = await query()

    if (result && result.error) {
      message.error(result.error)
      return
    }

    const answer = result ? result.answer : "Sorry, I couldn't find the answer"
    const sourceDocuments = result ? result.sourceDocuments : []

    setMessages((prevMessages: Message[]) => [
      ...prevMessages,
      { type: 'userMessage', message: input },
      {
        type: 'apiMessage',
        message: answer,
        verified: result ? result.verified : true,
        sourceDocuments: sourceDocuments,
        questionId: result ? result.questionId : null,
      },
    ])

    setIsLoading(false)
    setInput('')
  }

  const answerPreDeterminedQuestion = (question: string, answer: string) => {
    setMessages((prevMessages) => [
      ...prevMessages,
      { type: 'userMessage', message: question },
      {
        type: 'apiMessage',
        message: answer,
      },
    ])
    setPreDeterminedQuestions([])
  }

  // This scroll to bottom would work better if we had a giant chat history. It's just annoying in its current state
  // const scrollToBottom = () => {
  //   messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  // }
  // useEffect(() => {
  //   scrollToBottom()
  // }, [messages])

  const resetChat = () => {
    setMessages([
      {
        type: 'apiMessage',
        message:
          'Hello, how can I assist you? I can help with anything course related.',
      },
    ])
    setPreDeterminedQuestions([])
    hasAskedQuestion.current = false
    axios
      .get(`/chat/${cid}/allSuggestedQuestions`, {
        headers: { HMS_API_TOKEN: userInfo.chat_token?.token },
      })
      .then((res) => {
        res.data.forEach((question: any) => {
          setPreDeterminedQuestions((prev) => [
            ...prev,
            {
              question: question.pageContent,
              answer: question.metadata.answer,
            },
          ])
        })
      })
      .catch((err) => {
        console.error(err)
      })
  }

  if (!cid || !courseFeatures?.chatBotEnabled) {
    return <></>
  } else {
    return (
      <div
        className={cn(
          variant === 'small'
            ? 'fixed bottom-5 right-5 z-50 max-h-[90vh] w-screen max-w-[400px]'
            : variant === 'big'
              ? 'flex h-[80vh] w-[90%] flex-col overflow-auto'
              : variant === 'huge'
                ? 'flex h-[90vh] w-[90%] flex-col overflow-auto'
                : '',
        )}
      >
        {isOpen ? (
          <Card
            title="Course Chatbot"
            classNames={{
              header: 'pr-3',
              body: cn(
                'px-4 pb-4',
                variant === 'big' || variant === 'huge'
                  ? 'flex flex-col flex-auto'
                  : '',
              ),
            }}
            className={cn(
              variant === 'big' || variant === 'huge'
                ? 'flex w-full flex-auto flex-col overflow-y-auto'
                : '',
            )}
            extra={
              <>
                <Button onClick={resetChat} danger type="link" className="mr-3">
                  Reset Chat
                </Button>
                {variant === 'small' && (
                  <Button
                    onClick={() => setIsOpen(false)}
                    type="text"
                    icon={<CloseOutlined />}
                  />
                )}
              </>
            }
          >
            <div
              className={cn(
                variant === 'big' || variant === 'huge'
                  ? 'flex flex-auto flex-col justify-between'
                  : '',
              )}
            >
              <div
                className={cn(
                  'overflow-y-auto',
                  variant === 'small' ? 'max-h-[70vh]' : 'grow-1',
                )}
              >
                {messages &&
                  messages.map((item, index) => (
                    <Fragment key={index}>
                      {item.type === 'userMessage' ? (
                        <div className="align-items-start m-1 mb-3 flex justify-end">
                          <div
                            className={cn(
                              'mr-2 rounded-xl bg-blue-900 px-3 py-2 text-white',
                              variant === 'small'
                                ? 'max-w-[300px]'
                                : 'max-w-[90%]',
                            )}
                          >
                            {item.message ?? ''}
                          </div>
                          <Avatar
                            size="small"
                            className="min-w-6"
                            icon={<UserOutlined />}
                          />
                        </div>
                      ) : (
                        <div className="group mb-3 flex flex-grow items-start">
                          <Avatar
                            size="small"
                            className="min-w-6"
                            icon={<RobotOutlined />}
                          />
                          <div className="ml-2 flex flex-col gap-1">
                            <div className="flex items-start gap-2">
                              <div
                                className={cn(
                                  'rounded-xl px-3 py-2',
                                  item.verified
                                    ? 'bg-green-100'
                                    : 'bg-slate-100',
                                  variant === 'small'
                                    ? 'max-w-[280px]'
                                    : 'max-w-[90%]',
                                )}
                              >
                                {item.message ?? ''}
                                {item.verified && (
                                  <Tooltip title="A similar question has been asked before, and the answer has been verified by a faculty member">
                                    <CheckCircleOutlined
                                      style={{
                                        color: 'green',
                                        fontSize: '20px',
                                        marginLeft: '2px',
                                      }}
                                    />
                                  </Tooltip>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              {item.sourceDocuments &&
                                item.sourceDocuments.map(
                                  (sourceDocument, idx) => (
                                    <Tooltip
                                      title={
                                        sourceDocument.type
                                          ? sourceDocument.content
                                          : ''
                                      }
                                      key={idx}
                                    >
                                      <div className="align-items-start flex h-fit w-fit max-w-[280px] flex-wrap justify-start gap-x-2 rounded-xl bg-slate-100 p-1 font-semibold">
                                        <p className="px-2 py-1">
                                          {sourceDocument.docName}
                                        </p>
                                        {sourceDocument.pageNumbers &&
                                          sourceDocument.pageNumbers.map(
                                            (part) => (
                                              <div
                                                className={`flex items-center justify-center rounded-lg bg-blue-100 px-3 py-2 font-semibold transition ${
                                                  sourceDocument.sourceLink &&
                                                  'hover:bg-black-300 cursor-pointer hover:text-white'
                                                }`}
                                                key={`${sourceDocument.docName}-${part}`}
                                                onClick={() => {
                                                  if (
                                                    sourceDocument.sourceLink
                                                  ) {
                                                    window.open(
                                                      sourceDocument.sourceLink,
                                                    )
                                                  }
                                                }}
                                              >
                                                <p className="h-fit w-fit text-xs leading-4">
                                                  {`p. ${part}`}
                                                </p>
                                              </div>
                                            ),
                                          )}
                                      </div>
                                    </Tooltip>
                                  ),
                                )}
                            </div>
                          </div>
                        </div>
                      )}
                    </Fragment>
                  ))}

                {preDeterminedQuestions &&
                  !isLoading &&
                  preDeterminedQuestions.map((question) => (
                    <div
                      className="align-items-start m-1 mb-1 flex justify-end"
                      key={question.question}
                    >
                      <div
                        onClick={() =>
                          answerPreDeterminedQuestion(
                            question.question ?? '',
                            question.answer ?? '',
                          )
                        }
                        className="mr-2 max-w-[300px] cursor-pointer rounded-xl border-2 border-blue-900 bg-transparent px-3 py-2 text-blue-900 transition hover:bg-blue-900 hover:text-white"
                      >
                        {question.question}
                      </div>
                    </div>
                  ))}
                {isLoading && (
                  <Spin
                    style={{
                      display: 'block',
                      marginBottom: '10px',
                    }}
                  />
                )}
                <div ref={messagesEndRef} />
              </div>
              <div>
                <Space.Compact block size="large">
                  <TextArea
                    id="chatbot-input" // for the skip link (accessibility)
                    autoSize={{ minRows: 1.35, maxRows: 20 }}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="rounded-r-none"
                    placeholder="Ask something..."
                    onPressEnter={
                      input.trim().length > 0 ? handleAsk : undefined
                    }
                  />
                  <Button
                    type="primary"
                    onClick={handleAsk}
                    disabled={input.trim().length == 0 || isLoading}
                  >
                    Ask
                  </Button>
                </Space.Compact>
                {userInfo.chat_token && (
                  <Card.Meta
                    description={`You can ask the chatbot ${questionsLeft} more question${questionsLeft > 1 ? 's' : ''} today`}
                    className="mt-3"
                  />
                )}
              </div>
            </div>
          </Card>
        ) : (
          <Button
            type="primary"
            icon={<RobotOutlined />}
            size="large"
            className="mx-5 rounded-sm"
            onClick={() => setIsOpen(true)}
          >
            Chat now!
          </Button>
        )}
      </div>
    )
  }
}

export default Chatbot
