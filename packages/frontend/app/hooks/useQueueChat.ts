import { GetQueueChatResponse, SSEQueueChatResponse } from '@koh/common'
import { plainToClass } from 'class-transformer'
import { useCallback, useEffect, useRef, useState } from 'react'
import useSWR, { mutate, SWRResponse } from 'swr'
import { useEventSource } from './useEventSource'
import { API } from '../api'
import { useLocalStorage } from './useLocalStorage'

type queueChatResponse = SWRResponse<GetQueueChatResponse, any>

export interface useQueueChatReturn {
  queueChatData?: queueChatResponse['data']
  queueChatError: queueChatResponse['error']
  mutateQueueChat: queueChatResponse['mutate']
  newMessageCount: number
  resetNewMessageCount: () => void
}

export function useQueueChat(
  qid: number,
  questionId: number,
  staffId: number,
): useQueueChatReturn {
  const key = `/api/v1/queueChats/${qid}/${questionId}/${staffId}`
  const [newMessageCount, setNewMessageCount] = useState(0)

  // Use localStorage to persist the message count between page refreshes
  const [storedMessageCount, setStoredMessageCount, removeStoredMessageCount] =
    useLocalStorage<number>(`${key}-messageCount`, 0)

  // Ref to track the previous length of the messages array in case of updates
  const previousMessageCountRef = useRef<number>(storedMessageCount || 0)

  // Subscribe to SSE
  const isLive = useEventSource(
    `/api/v1/queueChats/${qid}/${questionId}/${staffId}/sse`,
    'queueChat',
    useCallback(
      (data: SSEQueueChatResponse) => {
        if (data.queueChat) {
          // Update the SWR cache with the new chat data
          mutate(key, plainToClass(GetQueueChatResponse, data.queueChat), false)
        }
      },
      [key],
    ),
  )

  // SWR fetch
  const {
    data: queueChatData,
    error: queueChatError,
    mutate: mutateQueueChat,
  } = useSWR(key, async () => API.queueChats.get(qid, questionId, staffId), {
    refreshInterval: isLive ? 0 : 10 * 1000,
  })

  // To update the hasNewMessages state only when new messages are added
  useEffect(() => {
    if (!queueChatData?.messages || !queueChatData) {
      return
    }

    const currentMessageCount = queueChatData.messages.length
    const previousMessageCount = previousMessageCountRef.current
    const newMessageCount = currentMessageCount - previousMessageCount

    if (newMessageCount > 0) {
      setNewMessageCount(newMessageCount)
    }

    // Update the stored message count in localStorage
    setStoredMessageCount(currentMessageCount)
    previousMessageCountRef.current = currentMessageCount
  }, [queueChatData, queueChatData?.messages, setStoredMessageCount])

  const resetNewMessageCount = useCallback(() => {
    setNewMessageCount(0)
    // When resetting, we want to update the stored count to the current count
    if (queueChatData?.messages) {
      setStoredMessageCount(queueChatData.messages.length)
      previousMessageCountRef.current = queueChatData.messages.length
    }
  }, [queueChatData, setStoredMessageCount])

  return {
    queueChatData,
    queueChatError,
    mutateQueueChat,
    newMessageCount,
    resetNewMessageCount,
  }
}
