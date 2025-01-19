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
  setHasNewMessagesFalse: () => void
}

export function useQueueChat(
  qid: number,
  studentId: number,
): useQueueChatReturn {
  const key = `/api/v1/queueChats/${qid}/${studentId}`

  // On desktop, this is used to know when to auto-open the chat
  // On mobile, this is used to "bounce" the chat button
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
    if (!queueChatData?.messages) {
      return
    }
    setHasNewMessages(true)
  }, [queueChatData?.messages])

  // Reset hasNewMessages state
  const setHasNewMessagesFalse = () => setHasNewMessages(false)

  return {
    queueChatData,
    queueChatError,
    mutateQueueChat,
    hasNewMessages,
    setHasNewMessagesFalse,
  }
}
