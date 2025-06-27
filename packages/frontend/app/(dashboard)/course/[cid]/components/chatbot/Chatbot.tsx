'use client'
import { useEffect, useState, useRef, ReactElement, Fragment } from 'react'
import {
  Input,
  Button,
  Card,
  Avatar,
  Spin,
  Tooltip,
  Space,
  Segmented,
  Popconfirm,
} from 'antd'
import {
  CheckCircleOutlined,
  UserOutlined,
  RobotOutlined,
  CloseOutlined,
} from '@ant-design/icons'
import { useCourseFeatures } from '@/app/hooks/useCourseFeatures'
import { useUserInfo } from '@/app/contexts/userContext'
import {
  cn,
  convertPathnameToPageName,
  getRoleInCourse,
  parseThinkBlock,
} from '@/app/utils/generalUtils'
import { Feedback } from './Feedback'
import {
  chatbotStartingMessageSystem,
  chatbotStartingMessageCourse,
  ChatbotQuestionType,
} from '@/app/typings/chatbot'
import { API } from '@/app/api'
import MarkdownCustom from '@/app/components/Markdown'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PreDeterminedQuestion, Role, Message } from '@koh/common'
import { Bot } from 'lucide-react'

const { TextArea } = Input

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
  preDeterminedQuestions,
  setPreDeterminedQuestions,
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
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
    if (messages.length === 1) {
      setPreDeterminedQuestions([])
      API.chatbot.studentsOrStaff
        .getSuggestedQuestions(courseIdToUse)
        .then((questions) => {
          setPreDeterminedQuestions(questions)
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
    setPreDeterminedQuestions,
    messages.length,
    setQuestionsLeft,
  ])

  const handleAsk = async () => {
    if (!hasAskedQuestion.current) {
      hasAskedQuestion.current = true
      setPreDeterminedQuestions([]) // clear predetermined questions upon the first question
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
        const answer = chatbotResponse.chatbotRepoVersion.answer
        const { thinkText, cleanAnswer } = parseThinkBlock(answer)
        const sourceDocuments =
          chatbotResponse.chatbotRepoVersion.sourceDocuments ?? []
        setMessages((prevMessages: Message[]) => [
          ...prevMessages,
          { type: 'userMessage', message: input },
          {
            type: 'apiMessage',
            message: thinkText ? cleanAnswer : answer,
            verified: chatbotResponse.chatbotRepoVersion.verified,
            sourceDocuments: sourceDocuments ? sourceDocuments : [],
            questionId: chatbotResponse.chatbotRepoVersion.questionId,
            thinkText: thinkText,
          },
        ])
        setHelpmeQuestionId(chatbotResponse?.helpmeRepoVersion?.id)
        setInteractionId(chatbotResponse?.helpmeRepoVersion?.interactionId)
      })
      .catch((err) => {
        console.error(err)
        const answer = "Sorry, I couldn't find the answer"
        setMessages((prevMessages: Message[]) => [
          ...prevMessages,
          { type: 'userMessage', message: input },
          {
            type: 'apiMessage',
            message: answer,
            verified: false,
            sourceDocuments: [],
            questionId: undefined,
            thinkText: null,
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
        setIsLoading(false)
        setInput('')
      })
  }

  const answerPreDeterminedQuestion = async (
    question: PreDeterminedQuestion,
  ) => {
    const { thinkText, cleanAnswer } = parseThinkBlock(question.metadata.answer)
    setMessages((prevMessages) => [
      ...prevMessages,
      { type: 'userMessage', message: question.pageContent },
      {
        type: 'apiMessage',
        message: thinkText ? cleanAnswer : question.metadata.answer,
        verified: question.metadata.verified,
        sourceDocuments: question.metadata.sourceDocuments,
        questionId: question.id,
        thinkText: thinkText,
      },
    ])
    setPreDeterminedQuestions([])

    const helpmeQuestion =
      await API.chatbot.studentsOrStaff.askSuggestedQuestion(courseIdToUse, {
        vectorStoreId: question.id,
        question: question.pageContent,
        responseText: question.metadata.answer, // store full question (including think text) in db
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

  const extractLMSLink = (content?: string) => {
    if (!content) return undefined
    const idx = content.indexOf('Page Link:')
    if (idx < 0) return undefined
    return content.substring(idx + 'Page Link:'.length).trim()
  }

  if (!cid || !courseFeatures?.chatBotEnabled) {
    return <></>
  } else {
    return isOpen ? (
      <div
        className={cn(
          variant === 'small'
            ? 'fixed bottom-0 z-50 max-h-[90vh] w-screen md:bottom-1 md:right-1 md:max-w-[400px]'
            : variant === 'big'
              ? 'flex h-[80vh] w-screen flex-col overflow-auto md:w-[90%]'
              : variant === 'huge'
                ? 'flex h-[90vh] w-screen flex-col overflow-auto md:w-[90%]'
                : '',
        )}
        style={{ zIndex: 1050 }}
      >
        <Card
          title="Chatbot"
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
                      <div className="group mb-3 flex flex-grow items-start">
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
                        <div className="ml-2 flex flex-col gap-1">
                          <div className="flex items-start gap-2">
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
                          <div className="flex flex-col gap-1">
                            {item.sourceDocuments &&
                            chatbotQuestionType === 'System' ? (
                              <div className="align-items-start flex h-fit w-fit max-w-[280px] flex-wrap justify-start gap-x-2 rounded-xl bg-slate-100 p-1 font-semibold">
                                <p className="px-2 py-1">User Guide</p>
                                <SourceLinkButton
                                  docName="User Guide"
                                  sourceLink="https://github.com/ubco-db/helpme/blob/main/packages/frontend/public/userguide.md"
                                />
                              </div>
                            ) : (
                              item.sourceDocuments &&
                              item.sourceDocuments.map(
                                (sourceDocument, idx) => (
                                  <Tooltip
                                    title={
                                      sourceDocument.type &&
                                      sourceDocument.type !=
                                        'inserted_lms_document'
                                        ? sourceDocument.content
                                        : ''
                                    }
                                    key={idx}
                                  >
                                    <div className="align-items-start flex h-fit w-fit max-w-[280px] flex-wrap justify-start gap-x-2 rounded-xl bg-slate-100 p-1 font-semibold">
                                      <p className="px-2 py-1">
                                        {sourceDocument.docName}
                                      </p>
                                      {sourceDocument.type ==
                                        'inserted_lms_document' &&
                                        extractLMSLink(
                                          sourceDocument.content,
                                        ) && (
                                          <SourceLinkButton
                                            docName={sourceDocument.docName}
                                            sourceLink={
                                              extractLMSLink(
                                                sourceDocument.content,
                                              ) ?? ''
                                            }
                                            part={0}
                                          />
                                        )}
                                      {sourceDocument.pageNumbers &&
                                        sourceDocument.pageNumbers.map(
                                          (part) => (
                                            <SourceLinkButton
                                              key={`${sourceDocument.docName}-${part}`}
                                              docName={sourceDocument.docName}
                                              sourceLink={
                                                sourceDocument.sourceLink
                                              }
                                              part={part}
                                            />
                                          ),
                                        )}
                                    </div>
                                  </Tooltip>
                                ),
                              )
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
              {preDeterminedQuestions &&
                !isLoading &&
                preDeterminedQuestions.map((question) => (
                  <div
                    className="align-items-start m-1 mb-1 flex justify-end"
                    key={question.id || question.pageContent}
                  >
                    <div
                      onClick={() => answerPreDeterminedQuestion(question)}
                      className="mr-2 max-w-[300px] cursor-pointer rounded-xl border-2 border-blue-900 bg-transparent px-3 py-2 text-blue-900 transition hover:bg-blue-900 hover:text-white"
                    >
                      {question.pageContent}
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
            </div>
            <div>
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
          </div>
        </Card>
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

const SourceLinkButton: React.FC<{
  docName: string
  sourceLink?: string
  part?: number
}> = ({ docName, sourceLink, part }) => {
  if (!sourceLink) {
    return null
  }
  const pageNumber = part && !isNaN(part) ? Number(part) : undefined

  return (
    <a
      className={`flex items-center justify-center rounded-lg bg-blue-100 px-3 py-2 font-semibold transition ${
        sourceLink && 'hover:bg-black-300 cursor-pointer hover:text-white'
      }`}
      key={`${docName}-${part}`}
      href={
        sourceLink +
        (pageNumber && sourceLink.startsWith('/api/v1/chatbot/document/')
          ? `#page=${pageNumber}`
          : '')
      }
      rel="noopener noreferrer"
      // open in new tab
      target="_blank"
    >
      <p className="h-fit w-fit text-xs leading-4">
        {part ? `p. ${part}` : 'Source'}
      </p>
    </a>
  )
}
