import { GetQueueChatResponse, SSEQueueChatResponse } from '@koh/common'
import { plainToClass } from 'class-transformer'
import { useCallback, useEffect, useRef, useState } from 'react'
import useSWR, { mutate, SWRResponse } from 'swr'
import { useEventSource } from './useEventSource'
import { API } from '../api'

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
  studentId: number,
): useQueueChatReturn {
  const key = `/api/v1/queueChats/${qid}/${studentId}`
  const [newMessageCount, setNewMessageCount] = useState(0)

  // Ref to track the previous length of the messages array in case of updates
  const previousMessageCountRef = useRef<number>(0)

  // Subscribe to SSE
  const isLive = useEventSource(
    `/api/v1/queueChats/${qid}/${studentId}/sse`,
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
  } = useSWR(key, async () => API.queueChats.index(qid, studentId), {
    refreshInterval: isLive ? 0 : 10 * 1000,
  })

  // To update the hasNewMessages state only when new messages are added
  useEffect(() => {
    if (!queueChatData?.messages) {
      return
    }

    const currentMessageCount = queueChatData.messages.length
    const previousMessageCount = previousMessageCountRef.current
    const newMessageCount = currentMessageCount - previousMessageCount

    if (newMessageCount > 0) {
      setNewMessageCount(newMessageCount)
    }

    previousMessageCountRef.current = currentMessageCount
  }, [queueChatData?.messages])

  const resetNewMessageCount = () => setNewMessageCount(0)

  return {
    queueChatData,
    queueChatError,
    mutateQueueChat,
    newMessageCount,
    resetNewMessageCount,
  }
}
