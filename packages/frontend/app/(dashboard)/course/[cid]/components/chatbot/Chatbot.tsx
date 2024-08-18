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

const { TextArea } = Input

export interface SourceDocument {
  docName: string
  sourceLink: string
  pageNumbers: number[]
  metadata?: { type?: string }
  // type?: string
  // content?: string
}

interface PreDeterminedQuestion {
  question: string
  answer: string
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
}

const Chatbot: React.FC<ChatbotProps> = ({ cid }): ReactElement => {
  const [input, setInput] = useState('')
  const { userInfo } = useUserInfo()
  const [isLoading, setIsLoading] = useState(false)
  const [_interactionId, setInteractionId] = useState<number | null>(null)
  const [preDeterminedQuestions, setPreDeterminedQuestions] = useState<
    PreDeterminedQuestion[]
  >([])
  const [questionsLeft, setQuestionsLeft] = useState<number>(0)
  const [messages, setMessages] = useState<Message[]>([
    {
      type: 'apiMessage',
      message:
        'Hello, how can I assist you? I can help with anything course related.',
    },
  ])
  const courseFeatures = useCourseFeatures(Number(cid))
  const [isOpen, setIsOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasAskedQuestion = useRef(false) // to track if the user has asked a question

  useEffect(() => {
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
              sourceDocuments: question.metadata.sourceDocuments,
              verified: question.metadata.verified,
            },
          ])
        })
      })
      .catch((err) => {
        console.error(err)
      })
    if (userInfo.chat_token) {
      setQuestionsLeft(userInfo.chat_token.max_uses - userInfo.chat_token.used)
    }
    return () => {
      setInteractionId(null)
    }
  }, [userInfo, cid])

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
      }
      return json
    } catch (error) {
      if (questionsLeft > 0) {
        setQuestionsLeft(questionsLeft - 1)
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

    setMessages((prevMessages) => [
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

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
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 max-h-[90vh] w-screen max-w-[400px]">
      {isOpen ? (
        <Card
          title="Course Chatbot"
          classNames={{
            header: 'pr-3',
            body: 'px-4 pb-4',
          }}
          extra={
            <>
              <Button onClick={resetChat} danger type="link" className="mr-3">
                Reset Chat
              </Button>
              <Button
                onClick={() => setIsOpen(false)}
                type="text"
                icon={<CloseOutlined />}
              />
            </>
          }
        >
          <div className="max-h-[70vh] overflow-y-auto">
            {messages &&
              messages.map((item, index) => (
                <Fragment key={index}>
                  {item.type === 'userMessage' ? (
                    <div className="align-items-start m-1 mb-3 flex justify-end">
                      <div className="mr-2 max-w-[300px] rounded-xl bg-blue-900 px-3 py-2 text-white">
                        {item.message ?? ''}
                      </div>
                      <Avatar size="small" icon={<UserOutlined />} />
                    </div>
                  ) : (
                    <div className="group mb-3 flex flex-grow items-start">
                      <Avatar size="small" icon={<RobotOutlined />} />
                      <div className="ml-2 flex flex-col gap-1">
                        <div className="flex items-start gap-2">
                          <div
                            className={`max-w-[280px] rounded-xl px-3 py-2 ${
                              item.verified ? 'bg-green-100' : 'bg-slate-100'
                            }`}
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
                            item.sourceDocuments.map((sourceDocument, idx) => (
                              <Tooltip
                                title={
                                  sourceDocument.type
                                    ? sourceDocument.content
                                    : ''
                                }
                                key={idx}
                              >
                                <div className="align-items-start flex h-fit w-fit max-w-[280px] justify-start gap-3 rounded-xl bg-slate-100 p-1 font-semibold">
                                  <p className="px-2 py-1">
                                    {sourceDocument.docName}
                                  </p>
                                  <div className="flex gap-1">
                                    {sourceDocument.pageNumbers &&
                                      sourceDocument.pageNumbers.map((part) => (
                                        <div
                                          className={`flex flex-grow items-center justify-center rounded-lg bg-blue-100 px-3 py-2 font-semibold transition ${
                                            sourceDocument.sourceLink &&
                                            'hover:bg-black-300 cursor-pointer hover:text-white'
                                          }`}
                                          key={`${sourceDocument.docName}-${part}`}
                                          onClick={() => {
                                            if (sourceDocument.sourceLink) {
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
                                      ))}
                                  </div>
                                </div>
                              </Tooltip>
                            ))}
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
                        question.question,
                        question.answer,
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
          <Space.Compact block size="large">
            <TextArea
              autoSize={{ minRows: 1.35, maxRows: 20 }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="rounded-r-none"
              placeholder="Ask something..."
              onPressEnter={input.trim().length > 0 ? handleAsk : undefined}
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

export default Chatbot
