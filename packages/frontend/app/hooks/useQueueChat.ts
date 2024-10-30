import { GetQueueChatResponse, SSEQueueResponse } from '@koh/common'
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

export function useQueueChat(qid: number): useQueueChatReturn {
  const key = `/api/v1/queueChats/${qid}`
  const previousMessageCount = useRef<number>(0)
  const [hasNewMessages, setHasNewMessages] = useState<boolean>(false)

  // Subscribe to SSE
  const isLive = useEventSource(
    `/api/v1/queues/${qid}/sse`,
    'queueChat',
    useCallback(
      (data: SSEQueueResponse) => {
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
  } = useSWR(key, async () => API.queueChats.index(qid), {
    refreshInterval: isLive ? 0 : 10 * 1000,
  })

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
