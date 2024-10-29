import {
  GetQueueChatResponse,
  ListQuestionsResponse,
  SSEQueueResponse,
} from '@koh/common'
import { plainToClass } from 'class-transformer'
import { useCallback, useRef } from 'react'
import useSWR, { mutate, SWRResponse } from 'swr'
import { useEventSource } from './useEventSource'
import { API } from '../api'

type queueChatResponse = SWRResponse<GetQueueChatResponse, any>

export interface useQueueChatReturn {
  queueChatData?: queueChatResponse['data']
  queueChatError: queueChatResponse['error']
  mutateQueueChat: queueChatResponse['mutate']
  isLive: boolean
}

const useDebouncedCallback = <T extends (...args: any[]) => void>(
  callback: T,
  delay: number,
): ((...args: Parameters<T>) => void) => {
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  return (...args: Parameters<T>) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    timerRef.current = setTimeout(() => {
      callback(...args)
    }, delay)
  }
}

export function useQueueChats(qid: number): useQueueChatReturn {
  const key = `/api/v1/queueChats/${qid}`
  // Subscribe to sse
  const isLive = useEventSource(
    `/api/v1/queues/${qid}/sse`,
    'queueChat',
    useCallback(
      (data: SSEQueueResponse) => {
        if (data.queueChat) {
          mutate(key, plainToClass(GetQueueChatResponse, data.queueChat), false)
        }
      },
      [key],
    ),
  )

  const {
    data: queueChatData,
    error: queueChatError,
    mutate: mutateQueueChat,
  } = useSWR(key, async () => API.queueChats.index(qid), {
    refreshInterval: isLive ? 0 : 10 * 1000,
  })
  return { queueChatData, queueChatError, mutateQueueChat, isLive }
}
