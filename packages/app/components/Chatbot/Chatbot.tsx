import React, { useEffect, useState } from 'react'
import { Input, Button, Card, Avatar, Spin, Tooltip, message } from 'antd'
import { CheckCircleOutlined } from '@ant-design/icons'
import styled from 'styled-components'
import { API } from '@koh/api-client'
import { UserOutlined, RobotOutlined } from '@ant-design/icons'
import router from 'next/router'
import { useProfile } from '../../hooks/useProfile'
import axios from 'axios'
import { useCourseFeatures } from '../../hooks/useCourseFeatures'

const ChatbotContainer = styled.div`
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 100vw;
  max-width: 400px;
  zindex: 9999;
`

export interface SourceDocument {
  docName: string
  sourceLink: string
  pageNumbers: number[]
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

export const ChatbotComponent: React.FC = () => {
  const [input, setInput] = useState('')
  const { cid } = router.query
  const profile = useProfile()
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

  useEffect(() => {
    axios
      .get(`/chat/${cid}/allSuggestedQuestions`, {
        headers: { HMS_API_TOKEN: profile?.chat_token?.token },
      })
      .then((res) => {
        res.data.forEach((question) => {
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
    if (profile && profile.chat_token) {
      setQuestionsLeft(profile.chat_token.max_uses - profile.chat_token.used)
    }
    return () => {
      setInteractionId(null)
    }
  }, [profile])

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
          HMS_API_TOKEN: profile.chat_token.token,
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
    setIsLoading(true)

    const result = await query()

    if (result && result.error) {
      message.error(result.error)
      return
    }

    const answer = result ? result.answer : "Sorry, I couldn't find the answer"
    const sourceDocuments = result ? result.sourceDocuments : []

    setMessages([
      ...messages,
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
    setMessages([
      ...messages,
      { type: 'userMessage', message: question },
      {
        type: 'apiMessage',
        message: answer,
      },
    ])
    setPreDeterminedQuestions([])
  }

  if (!cid || !courseFeatures?.chatBotEnabled) {
    return <></>
  }

  return (
    <ChatbotContainer className="max-h-[90vh]" style={{ zIndex: 1000 }}>
      {isOpen ? (
        <Card
          title="Course chatbot"
          extra={<a onClick={() => setIsOpen(false)}>Close</a>}
        >
          <div className="max-h-[70vh] overflow-y-auto">
            {messages &&
              messages.map((item) => (
                <>
                  {item.type === 'userMessage' ? (
                    <div className="align-items-start m-1 mb-3 flex justify-end">
                      <div className="mr-2 max-w-[300px] rounded-xl bg-blue-900 px-3 py-2 text-white">
                        {' '}
                        {item.message}
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
                            {item.message}
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
                            item.sourceDocuments.map((sourceDocument) => (
                              <div
                                className="align-items-start flex h-fit w-fit max-w-[280px] justify-start gap-3 rounded-xl bg-slate-100 p-1 font-semibold"
                                key={sourceDocument.docName}
                              >
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
                            ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
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
                    {' '}
                    {question.question}
                  </div>
                </div>
              ))}
            {/* TODO: Remove, answers should stream*/}
            {isLoading && (
              <Spin
                style={{
                  display: 'block',
                  marginBottom: '10px',
                }}
              />
            )}
          </div>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask something..."
            onPressEnter={input.trim().length > 0 ? handleAsk : undefined}
            suffix={
              <Button
                type="primary"
                className="bg-blue-900"
                onClick={handleAsk}
                disabled={input.trim().length == 0 || isLoading}
              >
                Ask
              </Button>
            }
          />

          {profile && profile.chat_token && (
            <Card.Meta
              description={`You can ask chatbot ${questionsLeft} more question(s)`}
              className="mt-3"
            />
          )}
        </Card>
      ) : (
        <Button
          type="primary"
          icon={<RobotOutlined />}
          size="large"
          className="mx-5"
          onClick={() => setIsOpen(true)}
        >
          Chat now!
        </Button>
      )}
    </ChatbotContainer>
  )
}
