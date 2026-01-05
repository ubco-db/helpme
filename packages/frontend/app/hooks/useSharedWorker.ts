import { useEffect, useState } from 'react'
import { getWorker } from '@/app/utils/workerUtils'

export enum WorkerTypes {
  WebSocket = '/workers/client_websocket.js',
}
export function useSharedWorker(type: WorkerTypes): SharedWorker | null {
  const [worker, setWorker] = useState<SharedWorker | null>(null)

  useEffect(() => {
    const instance = getWorker(type)
    setWorker(instance)
  }, [type])

  return worker
}
