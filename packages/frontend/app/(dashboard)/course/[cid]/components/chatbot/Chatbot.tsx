'use client'
import { Fragment, ReactElement, useEffect, useRef, useState } from 'react'
import {
  Avatar,
  Button,
  Card,
  Input,
  Popconfirm,
  Segmented,
  Space,
  Spin,
  Tooltip,
} from 'antd'
import {
  CheckCircleOutlined,
  CloseOutlined,
  RobotOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useCourseFeatures } from '@/app/hooks/useCourseFeatures'
import { useUserInfo } from '@/app/contexts/userContext'
import {
  cn,
  convertPathnameToPageName,
  getRoleInCourse,
} from '@/app/utils/generalUtils'
import { Feedback } from './Feedback'
import {
  ChatbotQuestionType,
  chatbotStartingMessageCourse,
  chatbotStartingMessageSystem,
} from '@/app/typings/chatbot'
import { API } from '@/app/api'
import MarkdownCustom from '@/app/components/Markdown'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Citation,
  HelpMeChatMessage,
  parseThinkBlock,
  Role,
  SuggestedQuestionResponse,
} from '@koh/common'
import { Bot } from 'lucide-react'
import ChatbotCitation from '@/app/(dashboard)/course/[cid]/components/chatbot/ChatbotCitation'

const { TextArea } = Input

interface ChatbotProps {
  cid: number
  variant?: 'small' | 'big' | 'huge'
  suggestedQuestions: SuggestedQuestionResponse[]
  setSuggestedQuestions: React.Dispatch<
    React.SetStateAction<SuggestedQuestionResponse[]>
  >
  questionsLeft: number
  setQuestionsLeft: React.Dispatch<React.SetStateAction<number>>
  messages: HelpMeChatMessage[]
  setMessages: React.Dispatch<React.SetStateAction<HelpMeChatMessage[]>>
  isOpen: boolean
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>
  interactionId?: number
  setInteractionId: React.Dispatch<React.SetStateAction<number | undefined>>
  helpmeQuestionId: number | undefined
  setHelpmeQuestionId: React.Dispatch<React.SetStateAction<number | undefined>>
  chatbotQuestionType: ChatbotQuestionType
  setChatbotQuestionType: React.Dispatch<
    React.SetStateAction<ChatbotQuestionType>
  >
}

const Chatbot: React.FC<ChatbotProps> = ({
  cid,
  variant = 'small',
  suggestedQuestions,
  setSuggestedQuestions,
  questionsLeft,
  setQuestionsLeft,
  messages,
  setMessages,
  isOpen,
  setIsOpen,
  interactionId,
  setInteractionId,
  helpmeQuestionId,
  setHelpmeQuestionId,
  chatbotQuestionType,
  setChatbotQuestionType,
}): ReactElement => {
  const [input, setInput] = useState('')
  const { userInfo, setUserInfo } = useUserInfo()
  const [isLoading, setIsLoading] = useState(false)
  const courseFeatures = useCourseFeatures(cid)
  const [scrollToLastMessage, setScrollToLastMessage] = useState(false)
  const [showScroll, setShowScroll] = useState(false)

  const messagesRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastMessageRef = useRef<HTMLDivElement>(null)

  const hasAskedQuestion = useRef(false) // to track if the user has asked a question
  const pathname = usePathname()
  const currentPageTitle = convertPathnameToPageName(pathname)
  const [popResetOpen, setPopResetOpen] = useState(false)
  // used to temporarily store what question type the user is trying to change to
  const [tempChatbotQuestionType, setTempChatbotQuestionType] =
    useState<ChatbotQuestionType | null>(null)
  const role = getRoleInCourse(userInfo, cid)

  const courseIdToUse =
    chatbotQuestionType === 'System'
      ? Number(process.env.NEXT_PUBLIC_HELPME_COURSE_ID) || -1
      : cid

  useEffect(() => {
    const messagesElement = messagesRef.current
    if (messagesElement) {
      const interval = setInterval(() => {
        if (!messagesElement) return
        const needsIndicator =
          (messagesElement.scrollTop + messagesElement.clientHeight) /
            messagesElement.scrollHeight <
          0.95
        if (showScroll == needsIndicator) return
        setShowScroll(needsIndicator)
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [showScroll])

  useEffect(() => {
    if (scrollToLastMessage) {
      scrollToLast()
      setScrollToLastMessage(false)
    }
  }, [scrollToLastMessage])

  useEffect(() => {
    if (messages.length === 1) {
      setSuggestedQuestions([])
      API.chatbot.studentsOrStaff
        .getSuggestedQuestions(courseIdToUse)
        .then((questions) => {
          setSuggestedQuestions(questions)
        })
        .catch((err) => {
          console.error(err)
        })
    }
    if (userInfo.chat_token) {
      setQuestionsLeft(userInfo.chat_token.max_uses - userInfo.chat_token.used)
    }
  }, [
    userInfo,
    courseIdToUse,
    setSuggestedQuestions,
    messages.length,
    setQuestionsLeft,
  ])

  const scrollToEnd = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'start',
      })
      setShowScroll(false)
    }
  }

  const scrollToLast = () => {
    if (lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'start',
      })
    }
  }

  const handleAsk = async () => {
    if (!hasAskedQuestion.current) {
      hasAskedQuestion.current = true
      setSuggestedQuestions([]) // clear predetermined questions upon the first question
    }

    setIsLoading(true)

    const data = {
      question:
        chatbotQuestionType === 'System'
          ? `${input}
            \nThis user is currently on the ${currentPageTitle}.
            \nThe user's role for this course is ${role === Role.PROFESSOR ? 'Professor (Staff)' : role === Role.TA ? 'TA (Staff)' : 'Student'}.`
          : input,
      history: messages,
      interactionId: interactionId,
    }

    await API.chatbot.studentsOrStaff
      .askQuestion(courseIdToUse, data)
      .then((chatbotResponse) => {
        const answer = chatbotResponse.answer
        const { thinkText, cleanAnswer } = parseThinkBlock(answer)
        const citations = chatbotResponse.citations ?? []
        setMessages((prevMessages: HelpMeChatMessage[]) => [
          ...prevMessages,
          { type: 'userMessage', message: input },
          {
            type: 'apiMessage',
            message: thinkText ? cleanAnswer : answer,
            verified: chatbotResponse.verified,
            citations: citations,
            questionId: chatbotResponse.questionId,
            thinkText: thinkText,
          },
        ])
        setHelpmeQuestionId(chatbotResponse?.internal?.id)
        setInteractionId(chatbotResponse?.internal?.interactionId)
      })
      .catch((err) => {
        console.error(err)
        const answer = "Sorry, I couldn't find the answer"
        setMessages((prevMessages: HelpMeChatMessage[]) => [
          ...prevMessages,
          { type: 'userMessage', message: input },
          {
            type: 'apiMessage',
            message: answer,
            verified: false,
            citations: [],
            questionId: undefined,
            thinkText: undefined,
          },
        ])
      })
      .finally(() => {
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
        setScrollToLastMessage(true)
        setIsLoading(false)
        setInput('')
      })
  }

  const answerPreDeterminedQuestion = async (
    question: SuggestedQuestionResponse,
  ) => {
    const { thinkText, cleanAnswer } = parseThinkBlock(question.answer)
    setMessages((prevMessages) => [
      ...prevMessages,
      { type: 'userMessage', message: question.question },
      {
        type: 'apiMessage',
        message: thinkText ? cleanAnswer : question.answer,
        verified: question.verified,
        citations: question.citations,
        questionId: question.id,
        thinkText: thinkText,
      },
    ])
    setSuggestedQuestions([])

    const helpmeQuestion =
      await API.chatbot.studentsOrStaff.askSuggestedQuestion(courseIdToUse, {
        vectorStoreId: question.id,
      })
    setHelpmeQuestionId(helpmeQuestion.id)
    setInteractionId(helpmeQuestion.interactionId)
  }

  /* newChatbotQuestionType was added to allow us to reset the chat using a new chatbotQuestionType.
  The reason being is that you can't just setChatbotQuestionType and then call resetChat because the resetChat call will finish before react updates the state
  */
  const resetChat = (newChatbotQuestionType?: string) => {
    setMessages([
      {
        type: 'apiMessage',
        message:
          (newChatbotQuestionType ?? chatbotQuestionType) === 'System'
            ? chatbotStartingMessageSystem
            : chatbotStartingMessageCourse,
      },
    ])
    hasAskedQuestion.current = false
    setInteractionId(undefined)
    setHelpmeQuestionId(undefined)
    setInput('')
  }

  if (!cid || !courseFeatures?.chatBotEnabled) {
    return <></>
  } else {
    return isOpen ? (
      <div
        className={cn(
          variant === 'small'
            ? 'fixed bottom-0 z-50 max-h-[70vh] min-w-[25vw] md:bottom-1 md:right-1'
            : variant === 'big'
              ? 'flex max-h-[80vh] w-screen flex-col md:w-full'
              : variant === 'huge'
                ? 'flex max-h-[90vh] w-screen flex-col md:w-full'
                : '',
          'overflow-y-hidden',
        )}
        style={{ zIndex: 1050 }}
      >
        <Card
          title="Chatbot"
          classNames={{
            header: 'pr-3 h-12',
            body: cn(
              'p-1',
              variant === 'big' || variant === 'huge'
                ? 'flex flex-col flex-auto'
                : 'w-full',
            ),
          }}
          className={cn(
            variant === 'big' || variant === 'huge'
              ? 'flex w-full flex-auto flex-col'
              : 'w-full',
          )}
          extra={
            <span>
              {Number(process.env.NEXT_PUBLIC_HELPME_COURSE_ID) &&
              messages.length > 1 ? (
                <Popconfirm
                  title="Are you sure? this will reset the chat"
                  getPopupContainer={(trigger) =>
                    trigger.parentNode as HTMLElement
                  }
                  open={tempChatbotQuestionType !== null}
                  onConfirm={() => {
                    if (tempChatbotQuestionType) {
                      setChatbotQuestionType(tempChatbotQuestionType)
                      setTempChatbotQuestionType(null)
                      resetChat(tempChatbotQuestionType)
                    }
                  }}
                  onCancel={() => setTempChatbotQuestionType(null)}
                  trigger={'click'}
                >
                  <Segmented<ChatbotQuestionType>
                    options={['Course', 'System']}
                    value={chatbotQuestionType}
                    onChange={(newValue) => {
                      if (newValue !== chatbotQuestionType) {
                        setTempChatbotQuestionType(newValue)
                      }
                    }}
                  />
                </Popconfirm>
              ) : (
                Number(process.env.NEXT_PUBLIC_HELPME_COURSE_ID) && (
                  <Segmented<ChatbotQuestionType>
                    options={['Course', 'System']}
                    value={chatbotQuestionType}
                    onChange={(value) => {
                      setChatbotQuestionType(value)
                      resetChat(value)
                    }}
                  />
                )
              )}
              <Popconfirm
                title="Are you sure you want to reset the chat?"
                getPopupContainer={(trigger) =>
                  trigger.parentNode as HTMLElement
                }
                open={popResetOpen}
                onOpenChange={(open) => {
                  if (messages.length > 1) {
                    setPopResetOpen(open)
                  } else {
                    // reset chat right away if there are no messages
                    resetChat()
                  }
                }}
                onConfirm={() => resetChat()}
              >
                <Button
                  danger
                  type="link"
                  className="ml-3 mr-3 px-0 md:ml-0 md:px-2"
                >
                  Reset Chat
                </Button>
              </Popconfirm>
              {variant === 'small' && (
                <Button
                  onClick={() => setIsOpen(false)}
                  type="text"
                  icon={<CloseOutlined />}
                />
              )}
            </span>
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
              ref={messagesRef}
              className={cn(
                variant === 'small'
                  ? 'flex max-h-[calc(70vh-112px)] w-full flex-col'
                  : variant === 'big'
                    ? 'flex max-h-[calc(80vh-112px)] w-full flex-col'
                    : variant === 'huge'
                      ? 'flex max-h-[calc(90vh-112px)] w-full flex-col'
                      : '',
                variant === 'small' ? '' : 'grow-1',
                'w-full overflow-y-auto',
              )}
            >
              {messages &&
                messages.map((item, index) => (
                  <Fragment key={index}>
                    {item.type === 'userMessage' ? (
                      <div
                        className="align-items-start m-1 mb-3 flex justify-end"
                        ref={
                          index == messages.length - 1 ? lastMessageRef : null
                        }
                      >
                        <div
                          className={cn(
                            'childrenMarkdownFormatted mr-2 rounded-xl bg-blue-900 px-3 py-2 text-white',
                            variant === 'small'
                              ? 'max-w-[300px]'
                              : 'max-w-[90%]',
                          )}
                        >
                          <MarkdownCustom variant="blue">
                            {item.message ?? ''}
                          </MarkdownCustom>
                        </div>
                        <Avatar
                          size="small"
                          className="min-w-6"
                          icon={<UserOutlined />}
                        />
                      </div>
                    ) : (
                      <div
                        className="group mb-3 flex items-start"
                        ref={
                          index == messages.length - 1 ? lastMessageRef : null
                        }
                      >
                        {item.thinkText ? (
                          <Tooltip
                            title={'Chatbot thoughts: ' + item.thinkText}
                            classNames={{
                              body: 'w-96 max-h-[80vh] overflow-y-auto',
                            }}
                          >
                            <div className="relative inline-block">
                              <Avatar
                                size="small"
                                className="min-w-6"
                                icon={<RobotOutlined />}
                              />
                              <div className="absolute right-0 top-0 -translate-y-1/4 translate-x-1/4 transform text-xs">
                                🧠
                              </div>
                            </div>
                          </Tooltip>
                        ) : (
                          <Avatar
                            size="small"
                            className="min-w-6"
                            icon={<RobotOutlined />}
                          />
                        )}
                        <div
                          className={cn(
                            'ml-2 flex flex-col gap-1',
                            variant === 'small'
                              ? 'max-w-[280px]'
                              : 'max-w-[90%]',
                          )}
                          ref={
                            index == messages.length - 1 ? lastMessageRef : null
                          }
                        >
                          <div
                            className={cn(
                              'flex items-start gap-2',
                              variant === 'small'
                                ? 'max-w-[280px]'
                                : 'max-w-[90%]',
                            )}
                          >
                            <div
                              className={cn(
                                'childrenMarkdownFormatted rounded-xl px-3 py-2',
                                item.verified ? 'bg-green-100' : 'bg-slate-100',
                                variant === 'small'
                                  ? 'max-w-[280px]'
                                  : 'max-w-[90%]',
                              )}
                            >
                              <MarkdownCustom variant="lightblue">
                                {item.message ?? ''}
                              </MarkdownCustom>
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
                          <div
                            className={cn(
                              'flex flex-row flex-wrap gap-1',
                              variant === 'small'
                                ? 'max-w-[280px]'
                                : 'max-w-[90%]',
                            )}
                          >
                            {item.citations &&
                            chatbotQuestionType === 'System' ? (
                              <ChatbotCitation
                                citation={
                                  {
                                    docName: 'User Guide',
                                    sourceLink:
                                      'https://github.com/ubco-db/helpme/blob/main/packages/frontend/public/userguide.md',
                                  } as Citation
                                }
                              />
                            ) : (
                              item.citations &&
                              item.citations.map((citation) => (
                                <ChatbotCitation
                                  key={`citation-${citation.questionId}-${citation.documentId}`}
                                  citation={citation}
                                />
                              ))
                            )}
                          </div>
                          {item.type === 'apiMessage' &&
                            index === messages.length - 1 &&
                            index !== 0 && (
                              <Feedback
                                courseId={courseIdToUse}
                                questionId={helpmeQuestionId ?? 0}
                              />
                            )}
                        </div>
                      </div>
                    )}
                  </Fragment>
                ))}
              {suggestedQuestions &&
                !isLoading &&
                suggestedQuestions.map((question) => (
                  <div
                    className="align-items-start m-1 mb-1 flex justify-end"
                    key={question.id}
                  >
                    <div
                      onClick={() => answerPreDeterminedQuestion(question)}
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
              {courseFeatures.asyncQueueEnabled &&
                chatbotQuestionType === 'Course' &&
                messages.length > 1 && (
                  <div>
                    Unhappy with your answer?{' '}
                    <Link
                      href={{
                        pathname: `/course/${cid}/async_centre`,
                        query: { convertChatbotQ: true },
                      }}
                    >
                      Convert to anytime question
                    </Link>
                  </div>
                )}
              <div ref={messagesEndRef} />
            </div>
          </div>
          <div
            className={
              'sticky bottom-0 h-12 border-t-2 border-t-slate-50 bg-white p-1'
            }
          >
            <Space.Compact block size="large">
              <TextArea
                id="chatbot-input"
                autoSize={{ minRows: 1.22, maxRows: 20 }}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="rounded-r-none text-sm"
                placeholder="Ask something... (Shift+Enter for new line)"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (input.trim().length > 0 && !isLoading) {
                      handleAsk()
                    }
                  }
                }}
              />
              <Button
                type="primary"
                onClick={handleAsk}
                disabled={input.trim().length === 0 || isLoading}
              >
                Ask
              </Button>
            </Space.Compact>
            {userInfo.chat_token && questionsLeft < 100 && (
              <Card.Meta
                description={`You can ask the chatbot ${questionsLeft} more question${
                  questionsLeft > 1 ? 's' : ''
                } today`}
                className="mt-3"
              />
            )}
          </div>
        </Card>
        <div className={'sticky bottom-14 w-full text-center'}>
          <div
            className={cn(
              'flex w-full items-center justify-center transition-opacity',
              showScroll ? 'opacity-100' : 'opacity-0',
            )}
          >
            <Button
              className={'rounded-md bg-white text-sm shadow-md'}
              type={'link'}
              onClick={() => scrollToEnd()}
            >
              Scroll to most recent message
            </Button>
          </div>
        </div>
      </div>
    ) : (
      <div
        className="fixed bottom-5 md:bottom-8 md:right-1 md:flex md:justify-end"
        style={{ zIndex: 1050 }}
      >
        <Button
          type="primary"
          icon={<Bot className="mt-0.5" />}
          size="large"
          className="z-50 mr-5 hidden rounded-sm shadow-md shadow-slate-400 md:flex"
          onClick={() => setIsOpen(true)}
        >
          Chatbot
        </Button>
        <Button
          type="primary"
          icon={<Bot className="mt-0.5" />}
          size="large"
          className="z-50 mx-5 rounded-full p-6 shadow-md shadow-slate-400 md:hidden"
          onClick={() => setIsOpen(true)}
        />
      </div>
    )
  }
}

export default Chatbot
