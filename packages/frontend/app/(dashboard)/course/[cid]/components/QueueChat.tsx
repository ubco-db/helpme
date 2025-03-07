import { Fragment, ReactElement, useEffect, useRef, useState } from 'react'
import { Badge, Button, Card, message, Space } from 'antd'
import UserAvatar from '@/app/components/UserAvatar'
import { MessageCircleMore } from 'lucide-react'
import TextArea from 'antd/es/input/TextArea'
import { API } from '@/app/api'
import { useQueueChat } from '@/app/hooks/useQueueChat'
import { CloseOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'
import { cn } from '@/app/utils/generalUtils'

interface QueueChatProps {
  queueId: number
  questionId: number
  isMobile: boolean
  hidden: boolean
  isStaff: boolean
  isChatbotOpen?: boolean
  announceNewMessage?: (newCount: number) => void
  onOpen?: () => void
  onClose?: () => void
}

const QueueChat: React.FC<QueueChatProps> = ({
  queueId,
  questionId,
  isMobile,
  hidden,
  isStaff,
  isChatbotOpen = false,
  announceNewMessage = (newCount: number) => {
    return
  },
  onOpen = () => {
    return
  },
  onClose = () => {
    return
  },
}): ReactElement => {
  const [isOpen, setIsOpen] = useState<boolean>(isMobile ? false : true)
  const [hasStudentEverOpenedIt, setHasStudentEverOpenedIt] =
    useState<boolean>(false)
  const [input, setInput] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const {
    queueChatData,
    queueChatError,
    mutateQueueChat,
    newMessageCount,
    resetNewMessageCount,
  } = useQueueChat(queueId, questionId)
  const messagesEndRef = useRef<HTMLDivElement | null>(null) // This handles auto scrolling

  // To always auto scroll to the bottom of the page when new messages are added
  useEffect(() => {
    if (messagesEndRef.current && isOpen) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [isOpen, queueChatData, queueChatData?.messages])

  // To handle new message events
  useEffect(() => {
    if (newMessageCount == 0 || !queueChatData) {
      return
    }
    if (!isMobile) {
      // This is for desktop's default behavior (auto open the chat) -- mobile has css to handle this
      setIsOpen(true)
      resetNewMessageCount()
      onOpen()
    } else {
      announceNewMessage(newMessageCount) // For mobile "view chats" button in queue page to know there are new messages
    }
  }, [newMessageCount, setIsOpen])

  const sendMessage = async () => {
    setIsLoading(true)
    if (questionId) {
      API.queueChats
        .sendMessage(queueId, questionId, input)
        .then(() => {
          mutateQueueChat()
          setInput('')
        })
        .catch((e) => {
          message.error(e)
        })
        .finally(() => {
          setIsLoading(false)
        })
    }
  }

  if (!queueChatData || queueChatError) {
    return <></>
  }

  return isOpen ? (
    <div
      className={cn(
        !isStaff ? 'fixed bottom-0 right-[1px] md:bottom-1 md:right-1' : '',
        !isStaff && isChatbotOpen ? 'md:right-[408px]' : 'md:right-40',
        'z-50 box-border w-full md:max-w-[400px]',
      )}
      style={{ zIndex: 1050 }}
    >
      <Card
        title={
          queueChatData && queueChatData.staff && queueChatData.student
            ? isStaff
              ? `${queueChatData.student.firstName} ${queueChatData.student.lastName ?? ''}`
              : `${queueChatData.staff.firstName} ${queueChatData.staff.lastName ?? ''}`
            : 'Loading...'
        }
        classNames={{
          header: 'pr-3',
          body: 'px-4 pb-4 pt-1 flex flex-col flex-auto',
        }}
        className="grow-1 flex min-h-[20vh] w-full flex-auto flex-col"
        extra={
          <Button
            onClick={() => {
              setIsOpen(false)
              resetNewMessageCount()
              onClose()
            }}
            type="text"
            icon={<CloseOutlined />}
          />
        }
      >
        <div className="flex flex-auto flex-col justify-between md:h-full">
          <div className="no-scrollbar max-h-[50vh] overflow-y-auto">
            <div className="mb-2 w-full pt-1 text-center text-xs italic text-gray-500">
              Your chat messages will not be recorded for your privacy but
              please remain respectful. Chat messages will remain until your
              question is resolved.
            </div>
            {queueChatData.messages &&
              queueChatData.messages.map((message, index) => {
                return (
                  <Fragment key={index}>
                    {/* checks if you are the one sending the message */}
                    {message.isStaff == isStaff ? (
                      <div className="mb-2 flex flex-row items-start justify-end gap-2">
                        <div className="flex max-w-[70%] flex-col rounded-xl bg-blue-900 p-2 text-white">
                          <span className="text-wrap text-sm">
                            {message.message}
                          </span>
                          <span className="text-xs">
                            {new Date(message.timestamp).toLocaleTimeString(
                              undefined,
                              {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true,
                                second: undefined,
                                timeZoneName: undefined,
                              },
                            )}
                          </span>
                        </div>
                        <UserAvatar
                          size="small"
                          username={
                            message.isStaff
                              ? queueChatData.staff.firstName
                              : queueChatData.student.firstName
                          }
                          photoURL={
                            message.isStaff
                              ? queueChatData.staff.photoURL
                              : queueChatData.student.photoURL
                          }
                        />
                      </div>
                    ) : (
                      <div className="mb-2 flex flex-row items-start justify-start gap-2">
                        <UserAvatar
                          size="small"
                          username={
                            message.isStaff
                              ? queueChatData.staff.firstName
                              : queueChatData.student.firstName
                          }
                          photoURL={
                            message.isStaff
                              ? queueChatData.staff.photoURL
                              : queueChatData.student.photoURL
                          }
                        />
                        <div className="flex max-w-[70%] flex-col rounded-xl bg-slate-100 p-2 text-slate-900">
                          <span className="text-sm">{message.message}</span>
                          <span className="text-xs">
                            {new Date(message.timestamp).toLocaleTimeString(
                              undefined,
                              {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true,
                                second: undefined,
                                timeZoneName: undefined,
                              },
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                  </Fragment>
                )
              })}
            <div ref={messagesEndRef} />
          </div>
          <div>
            <Space.Compact block size="large">
              <TextArea
                id="queuechat-input"
                autoSize={{ minRows: 1.35, maxRows: 20 }}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="rounded-r-none"
                placeholder={`Chat with your ${isStaff ? 'Student' : 'TA'}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (input.trim().length > 0 && !isLoading) {
                      sendMessage()
                    }
                  }
                }}
              />
              <Button
                type="primary"
                onClick={sendMessage}
                disabled={input.trim().length === 0 || isLoading}
              >
                Send
              </Button>
            </Space.Compact>
          </div>
        </div>
      </Card>
    </div>
  ) : isMobile && isStaff ? (
    // For mobile staff view, the queue chats go inside a drawer so this will look a little different
    <div style={{ zIndex: 1050, width: '100%', padding: '0.75rem' }}>
      <Badge
        count={newMessageCount}
        style={{ zIndex: 1050 }}
        className={`${hidden ? 'hidden ' : ''}${isStaff ? 'w-full ' : `${!isStaff ? `fixed ` : ''}bottom-5 right-5`}`}
        overflowCount={99}
      >
        <Button
          type="primary"
          size="large"
          className={`z-50 w-full rounded-sm shadow-md`}
          onClick={() => {
            setIsOpen(true)
            onOpen()
          }}
        >
          {queueChatData && queueChatData.staff && queueChatData.student
            ? isStaff
              ? `${queueChatData.student.firstName} ${queueChatData.student.lastName ?? ''}`
              : `${queueChatData.staff.firstName} ${queueChatData.staff.lastName ?? ''}`
            : 'Loading...'}
        </Button>
      </Badge>
    </div>
  ) : !isStaff ? (
    // if you're a student, show the pfp of the TA helping you as the button
    <div
      className={cn(
        hidden ? 'hidden ' : '',
        isChatbotOpen ? 'md:right-[408px]' : 'md:right-40',
        'fixed bottom-5 right-5 md:bottom-8',
      )}
      style={{ zIndex: 1050 }}
    >
      <Tooltip
        title={
          queueChatData && queueChatData.staff
            ? `Message ${queueChatData.staff.firstName} ${queueChatData.staff.lastName ?? ''}`
            : 'Message TA'
        }
        placement={isMobile ? 'left' : 'top'}
        open={isMobile && !hasStudentEverOpenedIt ? true : undefined}
      >
        <Button
          type="primary"
          size="large"
          className={cn(
            'ring-helpmeblue-light ring-offset-2 hover:ring focus:ring',
            'shadow-lg shadow-slate-400',
            'outline-3 outline-helpmeblue/50 outline md:outline-2',
            'rounded-full p-6 md:p-7 ',
          )}
          icon={
            <UserAvatar
              size={isMobile ? 54 : 60}
              className=""
              photoURL={queueChatData.staff.photoURL}
              username={`${queueChatData.staff.firstName} ${queueChatData.staff.lastName ?? ''}`}
            />
          }
          onClick={() => {
            setIsOpen(true)
            setHasStudentEverOpenedIt(true)
            onOpen()
          }}
        />
      </Tooltip>
    </div>
  ) : (
    // desktop for staff
    <div className="mb-7">
      <Button
        type="primary"
        size="large"
        className="rounded-sm shadow-md shadow-slate-400"
        icon={<MessageCircleMore />}
        onClick={() => {
          setIsOpen(true)
          resetNewMessageCount()
          onOpen()
        }}
      >
        {queueChatData && queueChatData.staff && queueChatData.student
          ? `${queueChatData.student.firstName} ${queueChatData.student.lastName ?? ''}`
          : 'Loading...'}
      </Button>
    </div>
  )
}
export default QueueChat
