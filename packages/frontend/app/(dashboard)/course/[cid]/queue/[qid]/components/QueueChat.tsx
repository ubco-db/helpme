import { Fragment, ReactElement, useState } from 'react'
import { Button, Card } from 'antd'
import { GetQueueChatResponse, Role } from '@koh/common'
import UserAvatar from '@/app/components/UserAvatar'

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
  const [isOpen, setIsOpen] = useState(false)

  const isStaff = role === Role.PROFESSOR || role === Role.TA

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
        </div>
      </Card>
    </div>
  ) : (
    <Button //TODO: change to chat with TA/student
      type="primary"
      size="large"
      className="mx-1 rounded-sm"
      onClick={() => setIsOpen(true)}
    >
      {`Chat with your ${isStaff ? 'TA' : 'Student'}`}
    </Button>
  )
}
export default QueueChat
