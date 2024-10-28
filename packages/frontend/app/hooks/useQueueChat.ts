import {
  GetQueueChatResponse,
  ListQuestionsResponse,
  SSEQueueResponse,
} from '@koh/common'
import { plainToClass } from 'class-transformer'
import { useCallback } from 'react'
import useSWR, { mutate, SWRResponse } from 'swr'
import { useEventSource } from './useEventSource'
import { API } from '../api'

type queueChatResponse = SWRResponse<GetQueueChatResponse, any>

interface UseQueueChatReturn {
  queueChatMessages?: queueChatResponse['data']
  queueChatError: queueChatResponse['error']
  mutateQueueChat: queueChatResponse['mutate']
}

export function useQueueChat(qid: number): UseQueueChatReturn {
  const key = `/api/v1/queue-chats/${qid}`
  // Subscribe to sse
  const isLive = useEventSource(
    `/api/v1/queues/${qid}/sse`,
    'queueChat',
    useCallback(
      (data: SSEQueueResponse) => {
        if (data.queueQuestions) {
          mutate(
            key,
            plainToClass(ListQuestionsResponse, data.queueQuestions),
            false,
          )
        }
      },
      [key],
    ),
  )

  const {
    data: queueChatMessages,
    error: queueChatError,
    mutate: mutateQueueChat,
  } = useSWR(key, async () => API.questions.index(qid), {
    refreshInterval: isLive ? 0 : 10 * 1000,
  })
  return { queueChatMessages, queueChatError, mutateQueueChat }
}
