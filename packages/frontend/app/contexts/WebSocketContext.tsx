'use client'

import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import * as crypto from 'crypto'
import { EventEmitter } from 'events'
import { useSharedWorker, WorkerTypes } from '@/app/hooks/useSharedWorker'

enum WebSocketMessageType {
  Initialize = 'socket_init',
  Connect = 'connect',
  Disconnect = 'disconnect',
  Subscribe = 'subscribe',
  Unsubscribe = 'unsubscribe',
  setHeaders = 'setHeaders',
  setAuth = 'setAuth',
}

type WSResponse = {
  success: boolean
  message: string
}

type WSContext = {
  onMessageEvent: EventEmitter
  initialize: () => Promise<WSResponse>
  connect: () => Promise<WSResponse>
  disconnect: () => Promise<WSResponse>
  subscribe: (
    event: string,
    params?: { [p: string]: any },
  ) => Promise<WSResponse>
  unsubscribe: (
    event?: string,
    params?: { [p: string]: any },
  ) => Promise<WSResponse>
  setHeaders: (headers?: { [p: string]: string }) => Promise<WSResponse>
  setAuth: (auth?: { [p: string]: any }) => Promise<WSResponse>
}
// Create context
const WebSocketContext = createContext<WSContext | undefined | null>(undefined)

interface WebSocketProviderProps {
  children: ReactNode
}

type WebSocketMessage = {
  type: 'ws_message'
}

type WebSocketData = {
  external_event: string
  data: any
} & WebSocketMessage

type WebSocketReply = {
  success: boolean
  message: string
  replyTo: string
} & WebSocketMessage

function generateUniqueId() {
  return crypto.randomBytes(32).toString('hex')
}

async function postMessage(
  worker: SharedWorker,
  message_type: WebSocketMessageType,
  data?: { [p: string]: any },
): Promise<WSResponse> {
  const messageId = generateUniqueId()
  let timeout: any = null

  return new Promise((resolve, reject) => {
    const messageListener = (event: MessageEvent<WebSocketReply>) => {
      if (event.data && event.data.replyTo === messageId) {
        const { success, message } = event.data
        // Remove the listener once the response is received
        worker.port.removeEventListener('message', messageListener)

        if (!event.data.success) {
          reject(new Error(message))
        } else {
          resolve({
            success,
            message,
          })
        }
        if (timeout) {
          clearTimeout(timeout)
        }
      }
    }

    worker.port.addEventListener('message', messageListener)

    worker.port.postMessage({
      ...(data ?? {}),
      type: message_type,
      messageId,
    })

    timeout = setTimeout(() => {
      worker.port.removeEventListener('message', messageListener)
      reject(new Error('WebSocket response timeout'))
      clearTimeout(timeout)
    }, 10000)
  })
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
}: WebSocketProviderProps) => {
  const worker = useSharedWorker(WorkerTypes.WebSocket)
  const [emitter, _] = useState(new EventEmitter())

  const url = useMemo(() => {
    return `${process.env.NEXT_PUBLIC_HOST_PROTOCOL}://${process.env.NEXT_PUBLIC_HOSTNAME}${process.env.NEXT_PUBLIC_HOSTNAME === 'localhost' && process.env.NEXT_PUBLIC_DEV_PORT ? `:${process.env.NEXT_PUBLIC_DEV_PORT}` : ''}`
  }, [])

  const opts = useMemo(
    () => ({
      forceNew: false,
      multiplex: true,
      reconnection: true,
      path: '/api/v1/ws',
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      timeout: 5000,
      autoConnect: false,
    }),
    [],
  )

  const ensureInitialized = useCallback(
    async (worker: SharedWorker | null): Promise<boolean> => {
      if (!worker) {
        return false
      }
      const initializeResult = await postMessage(
        worker,
        WebSocketMessageType.Initialize,
        {
          url,
          opts,
        },
      )
      if (!initializeResult.success) {
        return false
      }
      const connectResult = await postMessage(
        worker,
        WebSocketMessageType.Connect,
      )
      return connectResult.success
    },
    [url, opts],
  )

  const protectedPostMessage = useCallback(
    async (
      worker: SharedWorker | null,
      type: WebSocketMessageType,
      args?: { [p: string]: any },
    ): Promise<WSResponse> => {
      const init = await ensureInitialized(worker)
      if (!init) {
        return {
          success: false,
          message: 'Failed to initialize or connect with web socket.',
        }
      }
      return await postMessage(worker as SharedWorker, type, args)
    },
    [ensureInitialized],
  )

  useEffect(() => {
    if (!worker) return
    const listener = (event: MessageEvent<WebSocketData>) => {
      if (event.type !== 'message') {
        return
      }

      const { external_event, data } = event.data
      if (!external_event) {
        return
      }

      emitter.emit(external_event, data)
    }
    worker.port.addEventListener('message', listener)
    return () => worker.port.removeEventListener('message', listener)
  }, [emitter, worker])

  const contextValue = useMemo(() => {
    if (!worker) {
      return null
    }
    return {
      onMessageEvent: emitter,
      initialize: async () => {
        return await protectedPostMessage(
          worker,
          WebSocketMessageType.Initialize,
          {
            url,
            opts,
          },
        )
      },
      connect: async () => {
        return await protectedPostMessage(worker, WebSocketMessageType.Connect)
      },
      disconnect: async () => {
        return await protectedPostMessage(
          worker,
          WebSocketMessageType.Disconnect,
        )
      },
      subscribe: async (event: string, params?: { [p: string]: any }) => {
        return await protectedPostMessage(
          worker,
          WebSocketMessageType.Subscribe,
          {
            event,
            params,
          },
        )
      },
      unsubscribe: async (event?: string, params?: { [p: string]: any }) => {
        return await protectedPostMessage(
          worker,
          WebSocketMessageType.Unsubscribe,
          {
            event,
            params,
          },
        )
      },
      setHeaders: async (auth?: { [p: string]: any }) => {
        return await protectedPostMessage(
          worker,
          WebSocketMessageType.setHeaders,
          auth,
        )
      },
      setAuth: async (auth?: { [p: string]: any }) => {
        return await protectedPostMessage(
          worker,
          WebSocketMessageType.setAuth,
          auth,
        )
      },
    }
  }, [worker, emitter, protectedPostMessage, url, opts])

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  )
}

export const useWebSocketContext = (): WSContext => {
  const context = useContext(WebSocketContext)

  if (context === undefined) {
    throw new Error(
      'useWebSocketContext must be used within a WebSocketContextProvider',
    )
  }

  if (context === null) {
    throw new Error('useWebSocket must be used on the client')
  }

  return context
}

export const useWebSocket = (): WSContext => {
  return useWebSocketContext()
}
