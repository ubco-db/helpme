import { Fragment, ReactElement, useEffect, useState } from 'react'
import { Alert, Button, Card, Space } from 'antd'
import { Role } from '@koh/common'
import UserAvatar from '@/app/components/UserAvatar'
import { MessageCircleMore } from 'lucide-react'
import TextArea from 'antd/es/input/TextArea'
import { API } from '@/app/api'
import { useQueueChats } from '@/app/hooks/useQueueChats'
import { cn } from '@/app/utils/generalUtils'
import { CloseOutlined } from '@ant-design/icons'

interface QueueChatProps {
  role: Role
  queueId: number
  variant?: 'small' | 'big' | 'huge'
}

const QueueChat: React.FC<QueueChatProps> = ({
  role,
  queueId,
  variant = 'small',
}): ReactElement => {
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [input, setInput] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [beingHelped, setBeingHelped] = useState<boolean>(true) //PAT TODO: hard-coded for now
  const { queueChatData } = useQueueChats(queueId)
  // const { studentQuestion, studentDemo } = useStudentQuestion(queueId)

  //PAT TODO: Make this work with the chatbot menu

  const isStaff = role === Role.PROFESSOR || role === Role.TA

  const sendMessage = async () => {
    setIsLoading(true)
    try {
      API.queueChats.sendMessage(queueId, input).then(() => {
        setIsLoading(false)
        setInput('')
      })
    } catch (error) {
      console.error(error)
    }
  }

  // useEffect(() => {
  //   if (studentQuestion) {
  //     setBeingHelped(studentQuestion.status === OpenQuestionStatus.Helping)
  //   } else if (studentDemo) {
  //     setBeingHelped(studentDemo.status === OpenQuestionStatus.Helping)
  //   } else {
  //     setBeingHelped(false)
  //   }
  // }, [studentQuestion, studentDemo])

  if (!queueChatData) {
    return isOpen && (beingHelped || isStaff) ? (
      <Alert
        message="Chat data is not available."
        description="Please try again later or contact support if the issue persists."
        type="warning"
        showIcon
      />
    ) : (
      <></>
    )
  }

  return isOpen && (beingHelped || isStaff) ? (
    <div
      className={cn(
        variant === 'small'
          ? 'absolute right-2 top-20 z-50 h-[50vh] w-screen overflow-y-hidden md:max-w-[400px]'
          : variant === 'big'
            ? 'absolute right-2 top-20 flex h-[80vh] w-screen flex-col overflow-y-hidden md:w-[90%]'
            : variant === 'huge'
              ? 'absolute right-2 top-20 flex h-[90vh] w-screen flex-col overflow-y-hidden md:w-[90%]'
              : '',
      )}
    >
      <Card
        title={
          isStaff
            ? `${queueChatData.student.firstName} ${queueChatData.student.lastName}`
            : `${queueChatData.staff.firstName} ${queueChatData.staff.lastName}`
        }
        classNames={{
          header: 'pr-3',
          body: 'px-4 pb-4 flex flex-col flex-auto',
        }}
        className="flex max-h-[50vh] w-full flex-auto flex-col overflow-y-auto"
        extra={
          <Button
            onClick={() => setIsOpen(false)}
            type="text"
            icon={<CloseOutlined />}
          />
        }
      >
        <div className="flex flex-auto flex-col justify-between">
          <div className="grow-1 overflow-y-auto">
            {queueChatData.messages &&
              queueChatData.messages.map((message, index) => {
                return (
                  <Fragment key={index}>
                    {/* checks if you are the one sending the message */}
                    {message.isStaff == isStaff ? (
                      <div className="mb-2 flex flex-row items-start justify-end gap-2">
                        <div className="flex flex-col rounded-xl bg-cyan-900 p-2 text-white">
                          <span className="text-sm">{message.message}</span>
                          <span className="text-xs">
                            {new Date(message.timestamp).toLocaleTimeString(
                              undefined,
                              {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true,
                                second: undefined,
                                timeZoneName: 'short',
                              },
                            )}
                          </span>
                        </div>
                        <UserAvatar
                          size={40}
                          username={queueChatData!.staff.firstName}
                          photoURL={queueChatData!.staff.photoURL}
                        />
                      </div>
                    ) : (
                      <div className="mb-2 flex flex-row items-start justify-start gap-2">
                        <UserAvatar
                          size={40}
                          username={queueChatData!.staff.firstName}
                          photoURL={queueChatData!.staff.photoURL}
                        />
                        <div className="flex flex-col rounded-xl bg-slate-100 p-2 text-slate-900">
                          <span className="text-sm">{message.message}</span>
                          <span className="text-xs">
                            {new Date(message.timestamp).toLocaleTimeString(
                              undefined,
                              {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true,
                                second: undefined,
                                timeZoneName: 'short',
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
                placeholder={`Chat with your ${isStaff ? 'Student' : 'TA'} (Shift+Enter for new line)`}
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
    <div className="absolute right-2 top-20 flex justify-end">
      <Button
        type="primary"
        size="large"
        icon={<MessageCircleMore />}
        className="rounded-sm"
        onClick={() => setIsOpen(true)}
      >
        {`Chat with your ${isStaff ? 'Student' : 'TA'}`}
      </Button>
    </div>
  )
}
export default QueueChat
