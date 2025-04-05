import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { SendOutlined } from '@ant-design/icons'
import { Form, FormProps, message, Popover, Button, Input, Tooltip } from 'antd'
import { MessageCircleMore } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import CircleButton from './CircleButton'
import { useQueueChatsMetadatas } from '@/app/hooks/useQueueChatsMetadatas'

type FormValues = {
  message?: string
}

/* This is the button for students or TAs to start a chat with one another.

For staff, this button appears on each question card in the queue.

For students, this button appears on each StatusCard on the StaffList.

*/
const MessageButton: React.FC<{
  recipientName: string
  staffId: number
  queueId: number
  questionId?: number
  isStaff: boolean
}> = ({ recipientName, staffId, queueId, questionId, isStaff }) => {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false)
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const [isSendingLoading, setIsSendingLoading] = useState(false)
  const { queueChats, mutateQueueChats } = useQueueChatsMetadatas(queueId) // TODO: figure out a way to make useQueueChatMetadatas more efficient since there can be a lot of MessageButtons
  const hasAssociatedQueueChat = queueChats?.some(
    (chat) => chat.questionId === questionId,
  )
  const [form] = Form.useForm()
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  const sendMessage: FormProps<FormValues>['onFinish'] = async (values) => {
    if (!questionId) {
      message.error('You must have a question to send a message')
      return
    }
    try {
      setIsSendingLoading(true)
      const newQueueChatMetadata = await API.queueChats.startQueueChat(
        queueId,
        questionId,
        staffId,
      )
      await API.queueChats.sendMessage(
        queueId,
        questionId,
        staffId,
        values.message ?? '',
      )
      // preemptively mutate the queue chats to add a new queue chat
      mutateQueueChats([...(queueChats ?? []), newQueueChatMetadata])
      setIsPopoverOpen(false)
      setIsTooltipOpen(false)
    } catch (error) {
      message.error('Failed to send message: ' + getErrorMessage(error))
    } finally {
      setIsSendingLoading(false)
    }
  }

  const onFinishFailed: FormProps<FormValues>['onFinishFailed'] = (
    errorInfo,
  ) => {
    message.error(
      'Failed to send message: ' + errorInfo.errorFields[0].errors[0],
    )
  }

  useEffect(() => {
    if (isPopoverOpen && textAreaRef.current) {
      setTimeout(() => {
        textAreaRef.current?.focus()
      }, 100)
    }
  }, [isPopoverOpen])

  return (
    <Form form={form} onFinish={sendMessage} onFinishFailed={onFinishFailed}>
      <Popover
        title={`Message ${recipientName}`}
        trigger="click"
        classNames={{
          body: 'w-60',
        }}
        getPopupContainer={(trigger) => trigger.parentNode as HTMLElement}
        content={
          <div className="flex w-full flex-row items-start gap-x-2">
            <Form.Item name="message" className="mb-0 w-full">
              <Input.TextArea
                ref={textAreaRef}
                autoSize={{ minRows: 1, maxRows: 6 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    form.submit()
                  }
                }}
              />
            </Form.Item>
            <Form.Item className="mb-0">
              <Button
                type="primary"
                htmlType="submit"
                shape="circle"
                icon={<SendOutlined className="ml-1 text-base" />}
                loading={isSendingLoading}
              />
            </Form.Item>
          </div>
        }
        open={isPopoverOpen}
        onOpenChange={(open) => {
          if (hasAssociatedQueueChat) {
            setIsPopoverOpen(false)
            return
          }
          setIsPopoverOpen(open)
          if (open) {
            setIsTooltipOpen(false)
          }
        }}
      >
        <Tooltip
          id={`message-button-${recipientName}`}
          forceRender
          title={
            hasAssociatedQueueChat
              ? 'Chat already exists'
              : !questionId
                ? 'You must have a question in the queue to send a message'
                : `Message ${recipientName}`
          }
          open={isTooltipOpen}
          onOpenChange={(open) => {
            setIsTooltipOpen(open)
          }}
        >
          <span>
            {isStaff ? (
              <CircleButton
                disabled={hasAssociatedQueueChat}
                icon={<MessageCircleMore size={22} className="ml-0.5" />}
                onClick={() => setIsPopoverOpen(true)}
              />
            ) : (
              <Button
                type="text"
                aria-labelledby={`message-button-${recipientName}`}
                disabled={!questionId || hasAssociatedQueueChat}
                icon={
                  <MessageCircleMore
                    className={`${!questionId || hasAssociatedQueueChat ? 'text-gray-400' : 'text-helpmeblue'}`}
                  />
                }
                onClick={() => setIsPopoverOpen(true)}
              />
            )}
          </span>
        </Tooltip>
      </Popover>
    </Form>
  )
}

export default MessageButton
