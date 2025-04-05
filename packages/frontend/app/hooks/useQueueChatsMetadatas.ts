import {
  GetQueueChatResponse,
  GetQueueChatsResponse,
  SSEQueueResponse,
} from '@koh/common'
import useSWR, { mutate, SWRResponse } from 'swr'
import { useCallback, useEffect } from 'react'
import { useEventSource } from './useEventSource'
import { plainToClass, plainToInstance } from 'class-transformer'
import { API } from '../api'

type queueChatsResponse = SWRResponse<GetQueueChatsResponse, any>

export interface UseQueueChatsMetadatasReturn {
  queueChats: queueChatsResponse['data']
  queueChatsError: queueChatsResponse['error']
  mutateQueueChats: queueChatsResponse['mutate']
  isLive: boolean
}

type OnUpdate = (value: Date) => void

interface RefreshInfo {
  lastUpdated: Date
  onUpdates: Set<OnUpdate>
}

// Keep track of all the different Refresh information and callbacks.
// This is a global because useQueue can be used multiple times, but SWR's onSuccess overwrites other instances
const REFRESH_INFO: Record<string, RefreshInfo> = {}

/**
 * Notify all onUpdate subscribers that new data came in.
 */
function callOnUpdates(key: string) {
  const refreshInfo = REFRESH_INFO[key]
  refreshInfo.onUpdates.forEach((cb) => cb(refreshInfo.lastUpdated))
}

/**
 * Gets all queue chat metadatas for the user for a given queue.
 * @param qid Queue ID to get data for
 * @param onUpdate Optional callback to listen for when data is refetched, whether via HTTP or SSE
 */
export function useQueueChatsMetadatas(
  qid: number,
  onUpdate?: OnUpdate,
): UseQueueChatsMetadatasReturn {
  const key = `/api/v1/queues/${qid}/queueChats`
  if (!(key in REFRESH_INFO)) {
    REFRESH_INFO[key] = {
      lastUpdated: new Date(),
      onUpdates: new Set(),
    }
  }

  // Register onUpdate callback
  useEffect(() => {
    if (onUpdate) {
      const refreshInfo = REFRESH_INFO[key]
      refreshInfo.onUpdates.add(onUpdate)
      onUpdate(refreshInfo.lastUpdated)
      return () => {
        refreshInfo.onUpdates.delete(onUpdate)
      }
    }
  }, [onUpdate, key])

  const isLive = useEventSource(
    `/api/v1/queues/${qid}/sse`,
    'queueChats',
    useCallback(
      (data: SSEQueueResponse) => {
        if (data.queueChats !== undefined) {
          mutate(
            key,
            plainToInstance(GetQueueChatResponse, data.queueChats),
            false,
          )
          REFRESH_INFO[key].lastUpdated = new Date()
          callOnUpdates(key)
        }
      },
      [key],
    ),
  )

  const {
    data: queueChats,
    error: queueChatsError,
    mutate: mutateQueueChats,
  } = useSWR(
    key,
    useCallback(async () => API.queueChats.getMyQueueChats(Number(qid)), [qid]),
    {
      refreshInterval: isLive ? 0 : 10 * 1000,
      onSuccess: (_, key) => {
        REFRESH_INFO[key].lastUpdated = new Date()
        callOnUpdates(key)
      },
    },
  )

  return {
    queueChats,
    queueChatsError,
    mutateQueueChats,
    isLive,
  }
}
