import { Fragment, ReactElement, useEffect, useRef, useState } from 'react'
import { Alert, Badge, Button, Card, message, Space } from 'antd'
import { Role } from '@koh/common'
import UserAvatar from '@/app/components/UserAvatar'
import { MessageCircleMore } from 'lucide-react'
import TextArea from 'antd/es/input/TextArea'
import { API } from '@/app/api'
import { useQueueChat } from '@/app/hooks/useQueueChat'
import { CloseOutlined } from '@ant-design/icons'

interface QueueChatProps {
  role: Role
  queueId: number
  studentId: number
  isMobile: boolean
  hidden: boolean
  fixed?: boolean
  announceNewMessage?: () => void
  onOpen?: () => void
  onClose?: () => void
}

const QueueChat: React.FC<QueueChatProps> = ({
  role,
  queueId,
  studentId,
  isMobile,
  hidden,
  fixed = true,
  announceNewMessage = () => {
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
  const [input, setInput] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const {
    queueChatData,
    queueChatError,
    mutateQueueChat,
    hasNewMessages,
    setHasNewMessagesFalse,
  } = useQueueChat(queueId, studentId)
  const messagesEndRef = useRef<HTMLDivElement | null>(null) // This handles auto scrolling

  useEffect(() => {
    if (messagesEndRef.current && isOpen) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [isOpen, queueChatData, queueChatData?.messages])

  useEffect(() => {
    if (!hasNewMessages) {
      return
    }
    if (!isMobile) {
      // This is for desktop's default behaviour (auto open the chat) -- mobile has css to handle this
      setIsOpen(true)
      setHasNewMessagesFalse()
      onOpen()
    } else {
      announceNewMessage() // For mobile "view chats" button in queue page to know there are new messages
    }
  }, [hasNewMessages, setIsOpen])

  const isStaff = role === Role.PROFESSOR || role === Role.TA

  const sendMessage = async () => {
    setIsLoading(true)
    try {
      if (studentId) {
        API.queueChats.sendMessage(queueId, studentId, input).then(() => {
          mutateQueueChat()
          setIsLoading(false)
          setInput('')
        })
      }
    } catch (error) {
      console.error(error)
    }
  }

  if (!queueChatData || queueChatError) {
    return (
      <Alert
        className={`${fixed ? 'fixed ' : ''}md:bottom-8 right-0 box-border overflow-y-auto md:right-2`}
        message={`Chat data is not available.`}
        description="Please try again later or contact support if the issue persists."
        type="warning"
        showIcon
      />
    )
  }

  return isOpen ? (
    <div
      className={`${fixed ? 'fixed ' : ''}bottom-0 right-0 z-50 box-border w-full md:bottom-8 md:max-w-[400px]`}
      style={{ zIndex: 1050 }}
    >
      <Card
        title={
          queueChatData && queueChatData.staff && queueChatData.student
            ? isStaff
              ? `${queueChatData!.student.firstName} ${queueChatData!.student.lastName ?? ''}`
              : `${queueChatData!.staff.firstName} ${queueChatData!.staff.lastName ?? ''}`
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
              setHasNewMessagesFalse()
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
            {queueChatData!.messages &&
              queueChatData!.messages.map((message, index) => {
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
                              ? queueChatData!.staff.firstName
                              : queueChatData!.student.firstName
                          }
                          photoURL={
                            message.isStaff
                              ? queueChatData!.staff.photoURL
                              : queueChatData!.student.photoURL
                          }
                        />
                      </div>
                    ) : (
                      <div className="mb-2 flex flex-row items-start justify-start gap-2">
                        <UserAvatar
                          size="small"
                          username={
                            message.isStaff
                              ? queueChatData!.staff.firstName
                              : queueChatData!.student.firstName
                          }
                          photoURL={
                            message.isStaff
                              ? queueChatData!.staff.photoURL
                              : queueChatData!.student.photoURL
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
  ) : isMobile ? (
    <div style={{ zIndex: 50, width: '100%' }}>
      <Badge
        dot={hasNewMessages}
        className={`${hidden ? 'hidden ' : ''}${hasNewMessages ? 'animate-bounce ' : ''}${isStaff ? 'w-full ' : `${fixed ? `fixed ` : ''}bottom-8 right-3 `}`}
      >
        <Button
          type="primary"
          size="large"
          className={`w-full rounded-sm`}
          onClick={() => {
            setIsOpen(true)
            onOpen()
          }}
        >
          {queueChatData && queueChatData.staff && queueChatData.student
            ? isStaff
              ? `${queueChatData!.student.firstName} ${queueChatData!.student.lastName ?? ''}`
              : `${queueChatData!.staff.firstName} ${queueChatData!.staff.lastName ?? ''}`
            : 'Loading...'}
        </Button>
      </Badge>
    </div>
  ) : (
    <div
      className={`${fixed ? `fixed ` : ''}bottom-8 left-2 right-3 flex justify-end`}
      style={{ zIndex: 1050 }}
    >
      <Button
        type="primary"
        size="large"
        className="rounded-sm"
        icon={<MessageCircleMore />}
        onClick={() => {
          setIsOpen(true)
          setHasNewMessagesFalse()
          onOpen()
        }}
      >
        {queueChatData && queueChatData.staff && queueChatData.student
          ? isStaff
            ? `${queueChatData.student.firstName} ${queueChatData.student.lastName ?? ''}`
            : `${queueChatData.staff.firstName} ${queueChatData.staff.lastName ?? ''}`
          : 'Loading...'}
      </Button>
    </div>
  )
}
export default QueueChat
