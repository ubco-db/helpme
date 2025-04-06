import { ReactElement, useCallback, useEffect, useMemo, useState } from 'react'
import { Badge, Button, Popover } from 'antd'
import { X } from 'lucide-react'
import QueueChat from './QueueChat'
import { cn } from '@/app/utils/generalUtils'
import { GetQueueChatsResponse } from '@koh/common'

export interface MessageCount {
  newMessages: number
}

interface QueueChatsProps {
  queueId: number
  isMobile: boolean
  isStaff: boolean
  isChatbotOpen: boolean
  setRenderSmallChatbot: (render: boolean) => void
  setChatbotOpen: (open: boolean) => void
  queueChats?: GetQueueChatsResponse
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
  isChatbotOpen,
  setRenderSmallChatbot,
  setChatbotOpen,
  queueChats,
}): ReactElement => {
  // const { queueChats, queueChatsError, mutateQueueChats } =
  //   useQueueChatsMetadatas(queueId)
  const [messageCounts, setMessageCounts] = useState<
    Record<string, MessageCount>
  >({})
  const [mobileQueueChatsExpanded, setMobileQueueChatsExpanded] =
    useState(false) // To store the state of the mobile queue chat drawer
  const [currentChatId, setCurrentChatId] = useState<string | null>(null) // To store the currently opened chat via the question id
  const [seenChatPopover, setSeenChatPopover] = useState(false)
  const [showNameTooltips, setShowNameTooltips] = useState(false)

  const newMessagesInQueueChats = useMemo(() => {
    return Object.values(messageCounts).reduce(
      (sum, chat) => sum + chat.newMessages,
      0,
    )
  }, [messageCounts])

  const resetNewMessagesInQueueChats = () => {
    setMessageCounts({})
  }

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

  useEffect(() => {
    if (mobileQueueChatsExpanded) {
      setShowNameTooltips(true)
      setTimeout(() => {
        setShowNameTooltips(false)
      }, 1000)
    } else {
      setShowNameTooltips(false)
    }
    return () => {
      setShowNameTooltips(false)
    }
  }, [mobileQueueChatsExpanded])

  if (!queueChats) {
    return <></>
  }

  return isMobile ? (
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
      <button
        className={cn(
          isChatbotOpen ? 'hidden ' : '',
          'fixed ',
          currentChatId === null ? 'bottom-6 right-5' : 'bottom-1 right-0',
        )}
        style={{ zIndex: 1050 }}
        onClick={() => {
          if (mobileQueueChatsExpanded || queueChats.length <= 1) {
            return
          }
          setMobileQueueChatsExpanded(true)
          resetNewMessagesInQueueChats()
        }}
      >
        <Badge
          count={
            !mobileQueueChatsExpanded && queueChats.length > 1
              ? newMessagesInQueueChats
              : 0
          }
          overflowCount={9}
          style={{ zIndex: 1050 }}
          className="md:hidden"
          offset={[-4, 4]}
        >
          <div
            className={cn(
              'flex',
              mobileQueueChatsExpanded || queueChats.length <= 1
                ? 'h-full flex-col justify-center gap-2'
                : 'max-w-6 flex-row-reverse items-center justify-start',
            )}
          >
            {queueChats.map((chat, index) => {
              if (!chat.staff || !chat.student || !chat.staff.id) {
                console.error('chat attribute is not defined', chat)
                return null // should always be defined
              }
              const chatId = `${chat.questionId}-${chat.staff.id}`
              return (
                <div
                  className={cn(!mobileQueueChatsExpanded ? `transform` : '')}
                  style={
                    !mobileQueueChatsExpanded
                      ? {
                          transform: `translateX(${index * 36}px)`,
                          zIndex: queueChats.length - index,
                        }
                      : {}
                  }
                  key={chatId}
                >
                  <QueueChat
                    messageCounts={messageCounts}
                    setMessageCounts={setMessageCounts}
                    queueId={queueId}
                    questionId={chat.questionId}
                    staffId={chat.staff.id}
                    isMobile={isMobile}
                    isStaff={isStaff}
                    bubbleHidden={
                      !mobileQueueChatsExpanded && queueChats.length > 1
                    }
                    disableTheButton={
                      !mobileQueueChatsExpanded && queueChats.length > 1
                    }
                    showNameTooltip={showNameTooltips}
                    onOpen={() => {
                      setChatbotOpen(false)
                      setRenderSmallChatbot(false)
                      resetNewMessagesInQueueChats()
                      setCurrentChatId(chatId)
                    }}
                    onClose={() => {
                      setRenderSmallChatbot(true)
                      setCurrentChatId(null)
                      setMobileQueueChatsExpanded(false)
                    }}
                    hidden={
                      (currentChatId != chatId && currentChatId != null) ||
                      (isMobile && isChatbotOpen)
                    }
                  />
                </div>
              )
            })}
            {mobileQueueChatsExpanded && currentChatId === null && (
              <Button
                type="default"
                shape="circle"
                size="large"
                className="border border-gray-300 bg-gray-200 p-6 text-gray-500 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                icon={<X />}
                onClick={() => {
                  setMobileQueueChatsExpanded(false)
                  resetNewMessagesInQueueChats()
                }}
              />
            )}
          </div>
        </Badge>
      </button>
    </Popover>
  ) : (
    <div
      className={cn(
        'fixed bottom-1 right-0 box-border',
        'max-w-[70vw] flex-wrap',
        'flex items-end justify-end gap-3 pr-1',
        'overflow-visible',
        isChatbotOpen ? 'md:right-[408px]' : 'md:right-[9.5rem]',
      )}
    >
      {queueChats?.map((chat) => {
        if (!chat.staff || !chat.student || !chat.staff.id) {
          return null
        }
        const chatId = `${chat.questionId}-${chat.staff.id}`
        return (
          <QueueChat
            key={chatId}
            queueId={queueId}
            questionId={chat.questionId}
            staffId={chat.staff.id}
            isMobile={isMobile}
            isStaff={isStaff}
            hidden={false}
            messageCounts={messageCounts}
            setMessageCounts={setMessageCounts}
            bubbleHidden={false}
          />
        )
      })}
    </div>
  )
}

export default QueueChats
