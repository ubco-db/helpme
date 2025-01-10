import { GetQueueResponse, QueuePartial, SSEQueueResponse } from '@koh/common'
import useSWR, { mutate, SWRResponse, useSWRConfig } from 'swr'
import { useCallback, useEffect, useState } from 'react'
import { useEventSource } from './useEventSource'
import { plainToClass } from 'class-transformer'
import { API } from '../api'
import isEqual from 'lodash/isEqual'

type queueResponse = SWRResponse<QueuePartial, any>

interface UseQueueReturn {
  queue: queueResponse['data']
  queueError: queueResponse['error']
  mutateQueue: queueResponse['mutate']
  isLive: boolean
}

type OnUpdate = (value: Date) => void

interface RefreshInfo {
  lastUpdated: Date
  onUpdates: Set<OnUpdate>
}

const REFRESH_INFO: Record<string, RefreshInfo> = {}

/**
 * Notify all onUpdate subscribers that new data came in.
 */
function callOnUpdates(key: string) {
  const refreshInfo = REFRESH_INFO[key]
  refreshInfo.onUpdates.forEach((cb) => cb(refreshInfo.lastUpdated))
}

export function useQueue(qid: number, onUpdate?: OnUpdate): UseQueueReturn {
  const [queueState, setQueueState] = useState<QueuePartial | undefined>(
    undefined,
  )
  const key = `/api/v1/queues/${qid}`

  // Access SWR's global cache
  const { cache } = useSWRConfig()

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
    'queue',
    useCallback(
      async (data: SSEQueueResponse) => {
        if (!data.queue) return

        // Convert incoming SSE data
        const newQueue = plainToClass(GetQueueResponse, data.queue)

        // Read the current queue from SWR's cache
        const currentQueue = cache.get(key)

        // Only mutate if something actually changed
        if (!isEqual(currentQueue?.data, newQueue)) {
          mutate(key, newQueue, false)
          REFRESH_INFO[key].lastUpdated = new Date()
          callOnUpdates(key)
        }
      },
      [key, cache],
    ),
  )

  const {
    data: queue,
    error: queueError,
    mutate: mutateQueue,
  } = useSWR(
    key,
    useCallback(async () => API.queues.get(Number(qid)), [qid]),
    {
      refreshInterval: isLive ? 0 : 10_000,
      onSuccess: async (fetchedData, swrKey) => {
        // Convert once
        const newQueue = plainToClass(GetQueueResponse, fetchedData)

        // Get current cache value
        const currentQueue = cache.get(swrKey)

        // Only mutate if something actually changed
        if (!isEqual(currentQueue?.data, newQueue)) {
          mutate(swrKey, newQueue, false)
          REFRESH_INFO[swrKey].lastUpdated = new Date()
          callOnUpdates(swrKey)
        }
      },
    },
  )

  useEffect(() => {
    if (!isEqual(queue, queueState)) {
      setQueueState(queue)
    }
  }, [queue])

  useEffect(() => {
    console.log('queue changed', queueState)
  }, [queueState])

  return {
    queue: queueState,
    queueError,
    mutateQueue,
    isLive,
  }
}
