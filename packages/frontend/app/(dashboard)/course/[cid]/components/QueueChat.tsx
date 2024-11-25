import { Fragment, ReactElement, useEffect, useState } from 'react'
import { Alert, Button, Card, Space } from 'antd'
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
  fixed?: boolean
}

const QueueChat: React.FC<QueueChatProps> = ({
  role,
  queueId,
  studentId,
  fixed = true,
}): ReactElement => {
  const [isOpen, setIsOpen] = useState<boolean>(true)
  const [input, setInput] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const { queueChatData, mutateQueueChat, hasNewMessages } = useQueueChat(
    queueId,
    studentId,
  )

  useEffect(() => {
    if (hasNewMessages) {
      setIsOpen(true)
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

  if (!queueChatData && isOpen) {
    return (
      <Alert
        className={`${fixed ? 'fixed ' : ' '}bottom-8 right-0 box-border md:right-2`}
        message="Chat data is not available."
        description="Please try again later or contact support if the issue persists."
        type="warning"
        showIcon
      />
    )
  }

  return isOpen ? (
    <div
      className={`${fixed ? 'fixed ' : ' '} bottom-8 right-0 box-border max-h-[70vh] w-screen md:right-2 md:max-w-[400px]`}
      style={{ zIndex: 1050 }}
    >
      <Card
        title={
          isStaff
            ? `${queueChatData!.student.firstName} ${queueChatData!.student.lastName}`
            : `${queueChatData!.staff.firstName} ${queueChatData!.staff.lastName}`
        }
        classNames={{
          header: 'pr-3',
          body: 'px-4 pb-4 flex flex-col flex-auto',
        }}
        className="flex w-full flex-auto flex-col"
        extra={
          <Button
            onClick={() => setIsOpen(false)}
            type="text"
            icon={<CloseOutlined />}
          />
        }
      >
        <div className="flex flex-auto flex-col justify-between">
          <div className="no-scrollbar max-h-[40vh] overflow-y-auto">
            <div className="mb-2 w-full text-center text-xs italic text-gray-500">
              Your chat messages will not be recorded for your privacy but
              please remain respectful
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
  ) : (
    <div
      className="fixed bottom-8 right-3 flex justify-end md:left-2"
      style={{ zIndex: 1050 }}
    >
      <Button
        type="primary"
        size="large"
        className="rounded-sm"
        icon={<MessageCircleMore />}
        onClick={() => setIsOpen(true)}
      >
        {`Queue Chat`}
      </Button>
    </div>
  )
}
export default QueueChat
