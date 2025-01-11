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
  hasNewMessages: boolean
}

export function useQueueChat(
  qid: number,
  studentId: number,
): useQueueChatReturn {
  const key = `/api/v1/queueChats/${qid}/${studentId}`

  // On desktop, this is used to know when to auto-open the chat
  // On mobile, this is used to pulse the chat icon
  const previousMessageCount = useRef<number>(0)
  const [hasNewMessages, setHasNewMessages] = useState<boolean>(false)

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

  // To update the hasNewMessages state
  useEffect(() => {
    if (queueChatData?.messages) {
      const newMessageCount = queueChatData.messages.length
      if (newMessageCount > previousMessageCount.current) {
        setHasNewMessages(true)
      } else {
        setHasNewMessages(false)
      }
      previousMessageCount.current = newMessageCount
    }
  }, [queueChatData?.messages])

  return { queueChatData, queueChatError, mutateQueueChat, hasNewMessages }
}
