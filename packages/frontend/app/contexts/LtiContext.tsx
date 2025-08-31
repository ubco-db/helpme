'use client'

import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react'
import { useSearchParams } from 'next/navigation'
import { fetchAuthToken } from '@/app/api/cookieApi'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LtiMessages = [
  'lti.capabilities',
  'lti.getPageContent',
  'lti.getPageSettings',
  'lti.put_data',
  'lti.get_data',
  'lti.showAlert',
] as const

type LtiMessageType = (typeof LtiMessages)[number]

interface SupportedMessages {
  subject: string
  frame?: string
}

interface PageSettings {
  locale: string
  time_zone: string
  use_high_contrast: boolean
  active_brand_config_json_url: string
  window_width: number
}

// Define context type
interface LtiMessengerType {
  capabilities?: SupportedMessages[]
  pageContent?: string
  pageSettings?: PageSettings
  postPutData: (params: { key: string; value: string | null }) => void
  postGetData: (params: { key: string }) => void
  postShowAlert: (params: {
    alertType: 'success' | 'warning' | 'error'
    title: string
    body: string
  }) => void
}

interface LtiContextSpecific {
  authToken: string | null
  setOnGetDataResponse: React.Dispatch<
    React.SetStateAction<LtiMessageDataFx | undefined>
  >
  setOnPutDataResponse: React.Dispatch<
    React.SetStateAction<LtiMessageDataFx | undefined>
  >
}

type LtiContextType = LtiMessengerType & LtiContextSpecific

// Create context
const LtiContext = createContext<LtiContextType | undefined>(undefined)

type LtiMessageDataFx = (data: {
  key: string
  value: string | null
  message_id: string
}) => void
// Define props type for UserInfoProvider
interface LtiProviderProps {
  window: Window
  lti_storage_target?: string
  children: ReactNode
}

export const LtiContextProvider: React.FC<LtiProviderProps> = ({
  window,
  lti_storage_target,
  children,
}: LtiProviderProps) => {
  const searchParams = useSearchParams()
  const [onGetDataResponse, setOnGetDataResponse] = useState<LtiMessageDataFx>()
  const [onPutDataResponse, setOnPutDataResponse] = useState<LtiMessageDataFx>()

  const [authToken, setAuthToken] = useState<string | null>(null)

  const onGetData = (data: {
    key: string
    value: string | null
    message_id: string
  }) => {
    const { key, value } = data

    if (key == 'auth_token') {
      setAuthToken(value)
    }

    if (onGetDataResponse) {
      onGetDataResponse(data)
    }
  }

  const onPutData = (data: {
    key: string
    value: string | null
    message_id: string
  }) => {
    const { key, value } = data

    if (key == 'auth_token') {
      setAuthToken(value)
    }

    if (onPutDataResponse) {
      onPutDataResponse(data)
    }
  }

  const ltiMessenger = useLtiMessenger(
    window,
    lti_storage_target,
    onPutData,
    onGetData,
  )

  useEffect(() => {
    const getAuthToken = async () => {
      if (lti_storage_target) {
        try {
          ltiMessenger.postGetData({ key: 'auth_token' })
        } catch (_) {}
      }
      if (lti_storage_target) {
        const auth = searchParams.get('auth_token')
        setAuthToken(auth)
        ltiMessenger.postPutData({ key: 'auth_token', value: auth })
      } else {
        const auth = await fetchAuthToken()
        setAuthToken(auth)
      }
    }
    getAuthToken()
  }, [ltiMessenger, lti_storage_target, searchParams])

  // Return the user state and setUser function
  return (
    <LtiContext.Provider
      value={{
        ...ltiMessenger,
        setOnGetDataResponse,
        setOnPutDataResponse,
        authToken,
      }}
    >
      {children}
    </LtiContext.Provider>
  )
}

export const useLtiContext = (): LtiContextType => {
  const context = useContext(LtiContext)

  if (context === undefined) {
    throw new Error('useLtiContext must be used within a LtiContextProvider')
  }

  return context
}

function post_message_proxy(target: any, window_params: any) {
  target.postMessage(window_params, '*')
}

function postMessage(
  window: Window,
  subject: LtiMessageType,
  params?: any,
  lti_storage_target?: string,
) {
  try {
    if (subject == 'lti.put_data' || subject == 'lti.get_data') {
      if (!lti_storage_target) {
        throw new Error(
          'Use cookies if lti_storage_target claim is not defined',
        )
      }
      if (!params) {
        throw new Error('Missing parameters')
      }
      if (subject == 'lti.put_data') {
        ;['key', 'value', 'message_id'].forEach((k) => {
          if (!(k in params)) {
            throw new Error('Missing key, value or message_id params')
          }
        })
      }
      if (subject == 'lti.get_data') {
        ;['key', 'message_id'].forEach((k) => {
          if (!(k in params)) {
            throw new Error('Missing key, value or message_id params')
          }
        })
      }
      if (lti_storage_target == '_parent') {
        return post_message_proxy(window.parent, { subject, ...params })
      } else {
        post_message_proxy(
          (window.parent.frames as Record<string, any>)[
            'post_message_forwarding'
          ],
          { subject, ...params },
        )
      }
    }
    post_message_proxy(window.parent, { subject, ...params })
  } catch (err) {
    console.error(
      `Failed to postMessage (subject: ${subject}: ${(err as Error).message}`,
    )
  }
}

function useLtiMessenger(
  window: Window,
  lti_storage_target?: string,
  onPutDataResponse?: (data: {
    key: string
    value: string | null
    message_id: string
  }) => void,
  onGetDataResponse?: (data: {
    key: string
    value: string | null
    message_id: string
  }) => void,
): LtiMessengerType {
  const [keyMap, setKeyMap] = useState<Record<string, string>>({})
  const [capabilities, setCapabilities] = useState<SupportedMessages[]>()
  const [pageContent, setPageContent] = useState<string>()
  const [pageSettings, setPageSettings] = useState<PageSettings>()

  const generateMessageId = () => {
    const generate = (len: number) => {
      let gen = ''
      for (let i = 0; i < len; i++) {
        gen += Math.floor(Math.random() * 16).toString(16)
      }
      return gen
    }
    let id: string
    do {
      id = generate(32)
    } while (Object.values(keyMap).includes(id))
    return id
  }

  useEffect(() => {
    const listeningFunction = (event: MessageEvent) => {
      const data = JSON.parse(event.data)
      if (data.error) {
        console.error(
          `Error returned from postMessage: ${event.data.error.code}: ${event.data.error.message}`,
        )
        return
      }

      const subject = data.subject as string
      const original = subject.substring(
        0,
        subject.indexOf('.response'),
      ) as LtiMessageType

      if (
        (subject == 'lti.put_data' || subject == 'lti.get_data') &&
        data.message_id != keyMap[data.key]
      ) {
        console.error(
          `Error: mismatched message_id for subject ${subject} and key ${data.key}`,
        )
      }

      switch (original) {
        case 'lti.capabilities':
          setCapabilities(data.supported_messages)
          break
        case 'lti.getPageContent':
          setPageContent(data.pageContent)
          break
        case 'lti.getPageSettings':
          setPageSettings(data.pageSettings)
          break
        case 'lti.put_data':
          if (onPutDataResponse) onPutDataResponse(data)
          break
        case 'lti.get_data':
          if (onGetDataResponse) onGetDataResponse(data)
          break
        case 'lti.showAlert':
          break
      }
    }
    window.addEventListener('message', listeningFunction)
    return window.removeEventListener('message', listeningFunction)
  }, [onGetDataResponse, onPutDataResponse, window, keyMap])

  return {
    capabilities,
    pageContent,
    pageSettings,
    postPutData: (params: { key: string; value: string | null }) => {
      const msgId = generateMessageId()
      setKeyMap((prev) => ({ ...prev, [params.key]: msgId }))
      postMessage(
        window,
        'lti.put_data',
        { ...params, message_id: msgId },
        lti_storage_target,
      )
    },
    postGetData: (params: { key: string }) => {
      if (!keyMap[params.key])
        throw new Error('No previous put data information found')
      const message_id = keyMap[params.key]
      postMessage(
        window,
        'lti.get_data',
        { ...params, message_id },
        lti_storage_target,
      )
    },
    postShowAlert: (params: {
      alertType: 'success' | 'warning' | 'error'
      title: string
      body: string
    }) => postMessage(window, 'lti.showAlert', params),
  }
}
