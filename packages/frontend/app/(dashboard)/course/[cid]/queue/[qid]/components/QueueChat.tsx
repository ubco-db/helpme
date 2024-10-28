import { Fragment, ReactElement, useState } from 'react'
import { Button, Card, Space } from 'antd'
import { GetQueueChatResponse, Role } from '@koh/common'
import UserAvatar from '@/app/components/UserAvatar'
import { MessageCircleMore } from 'lucide-react'
import TextArea from 'antd/es/input/TextArea'
import { API } from '@/app/api'

interface QueueChatProps {
  role: Role
  queueId: number
  chatData: GetQueueChatResponse
}

const QueueChat: React.FC<QueueChatProps> = ({
  role,
  queueId,
  chatData,
}): ReactElement => {
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [input, setInput] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const isStaff = role === Role.PROFESSOR || role === Role.TA
  const sendMessage = async () => {
    setIsLoading(true)
    try {
      API.queueChats.sendMessage(queueId, input)
    } catch (error) {
      console.error(error)
    }
  }

  return isOpen ? (
    <div className="flex h-[80vh] w-screen flex-col overflow-auto bg-slate-200 md:w-[90%]">
      <Card
        title={
          isStaff
            ? `${chatData.student.firstName} ${chatData.student.lastName}`
            : `${chatData.staff.firstName} ${chatData.staff.lastName}`
        }
        classNames={{
          header: 'pr-3',
          body: 'px-4 pb-4 flex flex-col flex-auto',
        }}
        className="flex w-full flex-auto flex-col overflow-y-auto"
      >
        <div className="flex flex-auto flex-col justify-between">
          <div className="grow-1 overflow-y-auto">
            {chatData.messages &&
              chatData.messages.map((message, index) => {
                return (
                  <Fragment key={index}>
                    {/* checks if you are the one sending the message */}
                    {message.isStaff == isStaff ? (
                      <div className="mb-2 flex flex-row items-start gap-2">
                        <div className="flex flex-col rounded-xl bg-cyan-900 text-white">
                          <span className="text-sm">{message.message}</span>
                          <span className="text-xs">
                            {message.timestamp.toLocaleTimeString(undefined, {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                              second: undefined,
                              timeZoneName: 'short',
                            })}
                          </span>
                        </div>
                        <UserAvatar
                          size={40}
                          username={chatData.staff.firstName}
                          photoURL={chatData.staff.photoURL}
                        />
                      </div>
                    ) : (
                      <div className="mb-2 flex flex-row items-start gap-2">
                        <UserAvatar
                          size={40}
                          username={chatData.staff.firstName}
                          photoURL={chatData.staff.photoURL}
                        />
                        <div className="flex flex-col rounded-xl bg-slate-100 text-slate-900">
                          <span className="text-sm">{message.message}</span>
                          <span className="text-xs">
                            {message.timestamp.toLocaleTimeString(undefined, {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                              second: undefined,
                              timeZoneName: 'short',
                            })}
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
                placeholder={`Chat with your ${isStaff ? 'TA' : 'Student'} (Shift+Enter for new line)`}
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
                Ask
              </Button>
            </Space.Compact>
          </div>
        </div>
      </Card>
    </div>
  ) : (
    <Button //TODO: change to chat with TA/student
      type="primary"
      size="large"
      icon={<MessageCircleMore />}
      className="mx-1 rounded-sm"
      onClick={() => setIsOpen(true)}
    >
      {`Chat with your ${isStaff ? 'TA' : 'Student'}`}
    </Button>
  )
}
export default QueueChat
