import { ReactElement, useEffect, useState } from 'react'
import { Badge, Button, Drawer, Popover } from 'antd'
import { MessageCircleMore, X } from 'lucide-react'
import QueueChat from './QueueChat'
import { QueueChatPartial } from '@koh/common'
import { cn } from '@/app/utils/generalUtils'
import { useQueueChatsMetadatas } from '@/app/hooks/useQueueChatsMetadatas'

interface QueueChatsProps {
  queueId: number
  isMobile: boolean
  isStaff: boolean
  isChatbotOpen?: boolean
  setRenderSmallChatbot?: (render: boolean) => void
  setChatbotOpen?: (open: boolean) => void
}

/* Widget that has all queue chats for the user.
  Each queue chat is a picture of the other person in the chat.
  On mobile, all pictures are stacked on top of each other, where tapping them will expand them and let them choose which one to open (also only 1 chat can be open at a time).
  On desktop, all pictures are next to each other, and clicking on them will open the chat (multiple chats can be open at a time).
*/
const QueueChats: React.FC<QueueChatsProps> = ({
  queueId,
  isMobile,
  isStaff,
  isChatbotOpen = false,
  setRenderSmallChatbot = (render: boolean) => {
    return
  },
  setChatbotOpen = (open: boolean) => {
    return
  },
}): ReactElement => {
  const { queueChats, queueChatsError, mutateQueueChats } =
    useQueueChatsMetadatas(queueId)
  const [newMessagesInQueueChats, setNewMessagesInQueueChats] = useState(0)
  const [mobileQueueChatsExpanded, setMobileQueueChatsExpanded] =
    useState(false) // To store the state of the mobile queue chat drawer
  const [currentChatQuestionId, setCurrentChatQuestionId] = useState<number>(-1) // To store the currently opened chat via the question id
  const [seenChatPopover, setSeenChatPopover] = useState(false)

  useEffect(() => {
    const seenQueueChatPopover =
      localStorage.getItem('seenChatPopover') == 'true'
    setSeenChatPopover(seenQueueChatPopover)
    if (!seenQueueChatPopover) {
      setTimeout(() => {
        setSeenChatPopover(true)
        localStorage.setItem('seenChatPopover', 'true')
      }, 6000) // message will disappear after 6 seconds
    }
  }, [])

  if (!queueChats) {
    return <></>
  }

  return isMobile ? (
    <button
      className={`${mobileQueueChatsExpanded || isChatbotOpen ? 'hidden ' : ''}`}
      style={{ zIndex: 1050 }}
      onClick={() => {
        if (mobileQueueChatsExpanded) {
          return
        }
        setMobileQueueChatsExpanded(true)
        setNewMessagesInQueueChats(0)
      }}
    >
      <Popover
        content={`Message ${
          isStaff
            ? queueChats.length === 1
              ? queueChats[0].student.firstName
              : 'Students'
            : queueChats.length === 1
              ? queueChats[0].staff.firstName
              : 'TAs'
        }`}
        placement={'left'}
        open={!seenChatPopover}
      >
        <Badge
          count={newMessagesInQueueChats}
          overflowCount={99}
          offset={[-4, 4]}
        >
          <div
            className={cn(
              'flex',
              mobileQueueChatsExpanded
                ? 'h-full flex-col justify-center gap-2'
                : 'relative flex-row justify-end',
            )}
          >
            {queueChats.map((chat, index) => {
              if (!chat.staff || !chat.student || !chat.staff.id) {
                console.error('chat attribute is not defined', chat)
                return null // should always be defined
              }
              return (
                <div
                  className={
                    !mobileQueueChatsExpanded ? `absolute right-0` : ''
                  }
                  style={
                    !mobileQueueChatsExpanded
                      ? {
                          right: `${index * 10}px`,
                          zIndex: queueChats.length - index,
                        }
                      : {}
                  }
                  key={chat.id}
                >
                  <QueueChat
                    queueId={queueId}
                    questionId={chat.questionId}
                    staffId={chat.staff.id}
                    isMobile={isMobile}
                    isStaff={isStaff}
                    disableButton={!mobileQueueChatsExpanded}
                    announceNewMessage={(newCount: number) =>
                      setNewMessagesInQueueChats(
                        (prevCount) => prevCount + newCount,
                      )
                    }
                    onOpen={() => {
                      setChatbotOpen(false)
                      setRenderSmallChatbot(false)
                      setCurrentChatQuestionId(chat.questionId)
                    }}
                    onClose={() => {
                      setRenderSmallChatbot(true)
                      setCurrentChatQuestionId(-1)
                    }}
                    hidden={
                      (currentChatQuestionId != chat.questionId &&
                        currentChatQuestionId != -1) ||
                      (isMobile && isChatbotOpen)
                    }
                  />
                </div>
              )
            })}
            {mobileQueueChatsExpanded && (
              <Button
                type="default"
                shape="circle"
                icon={<X />}
                onClick={() => {
                  setMobileQueueChatsExpanded(false)
                  setNewMessagesInQueueChats(0)
                }}
              />
            )}
          </div>
        </Badge>
      </Popover>
    </button>
  ) : (
    <div
      className={`fixed bottom-1 right-0 box-border max-h-[70vh] ${isChatbotOpen ? 'md:right-[408px]' : 'md:right-[9.5rem]'}`}
    >
      <div
        className={
          'box-border flex h-full max-w-[50vw] flex-row items-end justify-end gap-2 overflow-x-auto overflow-y-hidden'
        }
      >
        {queueChats?.map((chat) => {
          if (!chat.staff || !chat.student || !chat.staff.id) {
            return null
          }
          return (
            <QueueChat
              key={chat.id}
              queueId={queueId}
              questionId={chat.questionId}
              staffId={chat.staff.id}
              isMobile={isMobile}
              isStaff={isStaff}
              hidden={false}
            />
          )
        })}
      </div>
    </div>
  )
}

export default QueueChats
