import {
  Fragment,
  ReactElement,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Badge, Button, Card, message, Space } from 'antd'
import UserAvatar from '@/app/components/UserAvatar'
import TextArea from 'antd/es/input/TextArea'
import { API } from '@/app/api'
import { useQueueChat } from '@/app/hooks/useQueueChat'
import { CloseOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'
import { cn } from '@/app/utils/generalUtils'
import { MessageCount } from './QueueChats'

interface QueueChatProps {
  queueId: number
  questionId: number
  staffId: number
  isMobile: boolean
  hidden: boolean
  isStaff: boolean
  messageCounts: Record<string, MessageCount>
  setMessageCounts: (
    messageCounts: SetStateAction<Record<string, MessageCount>>,
  ) => void
  isChatbotOpen?: boolean
  onOpen?: () => void
  onClose?: () => void
  disableTheButton?: boolean // used to disable the onClick and hover effects of the button
  className?: string
  style?: React.CSSProperties
  showNameTooltip?: boolean
}

const QueueChat: React.FC<QueueChatProps> = ({
  queueId,
  questionId,
  staffId,
  isMobile,
  hidden,
  isStaff,
  disableTheButton = false,
  messageCounts,
  setMessageCounts,
  className,
  style,
  isChatbotOpen = false,
  showNameTooltip,
  onOpen = () => {
    return
  },
  onClose = () => {
    return
  },
}): ReactElement => {
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [input, setInput] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const {
    queueChatData,
    queueChatError,
    mutateQueueChat,
    newMessageCount,
    resetNewMessageCount,
  } = useQueueChat(queueId, questionId, staffId)

  const openChat = useCallback(() => {
    setIsOpen(true)
    resetNewMessageCount()
    onOpen()
  }, [onOpen, resetNewMessageCount, setIsOpen])

  const closeChat = useCallback(() => {
    setIsOpen(false)
    resetNewMessageCount()
    onClose()
  }, [onClose, resetNewMessageCount, setIsOpen])

  // log when the component mounts
  useEffect(() => {
    console.log('component mounted!!')
  }, [])

  const messagesEndRef = useRef<HTMLDivElement | null>(null) // This handles auto scrolling
  // To always auto scroll to the bottom of the page when new messages are added
  useEffect(() => {
    if (messagesEndRef.current && (isOpen || newMessageCount > 0)) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
      console.log('isOpen', isOpen)
      console.log('newMessageCount2', newMessageCount)
    }
  }, [isOpen, newMessageCount])

  // To handle new message events
  useEffect(() => {
    if (newMessageCount == 0 || isOpen) {
      return
    }
    if (!isMobile) {
      // This is for desktop's default behavior (auto open the chat) -- mobile has css to handle this
      openChat()
    } else {
      console.log('newMessageCount :(', newMessageCount)
      const chatId = `${questionId}-${staffId}`
      if (newMessageCount !== messageCounts[chatId]?.newMessages) {
        setMessageCounts({
          // For mobile "view chats" button in queue page to know there are new messages
          ...messageCounts,
          [chatId]: { newMessages: newMessageCount },
        })
      }
    }
  }, [isMobile, newMessageCount, openChat, isOpen])

  const sendMessage = async () => {
    setIsLoading(true)
    if (questionId) {
      API.queueChats
        .sendMessage(queueId, questionId, staffId, input)
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
      className={cn('z-50 box-border w-full md:right-40 md:max-w-[400px]')}
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
          <Button onClick={closeChat} type="text" icon={<CloseOutlined />} />
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
                id={`queuechat-input-${staffId}-${questionId}`}
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
                loading={isLoading}
                disabled={input.trim().length === 0 || isLoading}
              >
                Send
              </Button>
            </Space.Compact>
          </div>
        </div>
      </Card>
    </div>
  ) : (
    // if not open, show the pfp of the other person as the button
    <div
      className={cn(
        hidden ? 'hidden ' : '',
        // isChatbotOpen ? 'md:right-[408px]' : 'md:right-40',
        // 'relative bottom-0 md:bottom-4 ',
        'md:mb-7',
        className,
      )}
      style={{ zIndex: 1050, ...style }}
    >
      <Tooltip
        title={
          !isStaff
            ? queueChatData.staff
              ? `Message ${queueChatData.staff.firstName} ${queueChatData.staff.lastName ?? ''}`
              : 'Message TA'
            : queueChatData.student
              ? `Message ${queueChatData.student.firstName} ${queueChatData.student.lastName ?? ''}`
              : 'Message Student'
        }
        placement={isMobile ? 'left' : 'top'}
        open={showNameTooltip === true ? true : undefined}
      >
        <Badge
          count={newMessageCount}
          overflowCount={9}
          style={{ zIndex: 1050 }}
          offset={[-4, 4]}
        >
          <Button
            type="primary"
            size="large"
            className={cn(
              disableTheButton
                ? 'pointer-events-none'
                : 'ring-helpmeblue-light ring-offset-2 hover:ring focus:ring',
              'shadow-lg shadow-slate-400',
              'md:outline-3 outline-helpmeblue/50 outline outline-4',
              'rounded-full p-5 md:p-6 ',
            )}
            // className={cn(
            //   disableTheButton ? '' : 'hover:ring focus:ring',
            //   'ring-helpmeblue-light ring-offset-2',
            //   'shadow-lg shadow-slate-400',
            //   'outline-3 outline-helpmeblue/50 outline md:outline-2',
            //   'rounded-full p-6 md:p-7 ',
            // )}
            icon={
              <UserAvatar
                size={isMobile ? 48 : 54}
                className=""
                photoURL={
                  !isStaff
                    ? queueChatData.staff.photoURL
                    : queueChatData.student.photoURL
                }
                username={
                  !isStaff
                    ? `${queueChatData.staff.firstName} ${queueChatData.staff.lastName ?? ''}`
                    : `${queueChatData.student.firstName} ${queueChatData.student.lastName ?? ''}`
                }
              />
            }
            onClick={() => {
              if (disableTheButton) {
                return
              }
              openChat()
            }}
          />
        </Badge>
      </Tooltip>
    </div>
  )
}
export default QueueChat
