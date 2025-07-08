import React, { createContext, PropsWithChildren, useContext } from 'react'
import { ExternalToast, toast, Toaster } from 'sonner'
import { getErrorMessage } from '../utils/generalUtils'

/**
 * This file contains a context that allows for running async api calls with a callback
 * so that the callback can be used to update the UI with the result of the api call
 * regardless of the page the user is on.
 */

type AsyncCallback = (result: any, error?: any) => void
type NotifyOptions = {
  successMsg: string
  errorMsg: string
  appendApiError: boolean
  successDuration?: number
  errorDuration?: number
}

interface AsyncToasterContextProps {
  runAsyncToast: (
    apiCall: () => Promise<any>,
    callback: AsyncCallback,
    notifyOptions?: NotifyOptions,
  ) => void
}

const AsyncToasterContext = createContext<AsyncToasterContextProps>({
  runAsyncToast: () => {
    throw new Error(
      'runAsyncToast() not implemented. Did you forget to wrap your component in AsyncToasterProvider?',
    )
  },
})

export const useAsyncToaster = () => useContext(AsyncToasterContext)

const toastOptions: ExternalToast = {
  richColors: true,
  dismissible: true,
  duration: Infinity,
  closeButton: true,
}

export const AsyncToasterProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const runAsyncToast = (
    apiCall: () => Promise<any>,
    callback: AsyncCallback,
    notifyOptions?: NotifyOptions,
  ) => {
    apiCall()
      .then((result) => {
        if (notifyOptions) {
          toast.success(notifyOptions.successMsg, {
            ...toastOptions,
            duration: notifyOptions.successDuration ?? Infinity,
          })
        }
        callback(result)
      })
      .catch((error) => {
        if (!notifyOptions) {
          callback(null, error)
          return
        }

        if (notifyOptions.appendApiError) {
          toast.error(
            <div>
              <b>{`${notifyOptions.errorMsg}:`}</b>
              <br />
              <br />
              {getErrorMessage(error)}
            </div>,
            toastOptions,
          )
        } else {
          toast.error(notifyOptions.errorMsg, {
            ...toastOptions,
            duration: notifyOptions.errorDuration ?? Infinity,
          })
        }
        callback(null, error)
      })
  }

  return (
    <AsyncToasterContext.Provider value={{ runAsyncToast }}>
      <Toaster
        position="bottom-left"
        toastOptions={{
          className: 'rounded p-4 text-md font-semibold min-h-18 w-96',
        }}
      />
      {children}
    </AsyncToasterContext.Provider>
  )
}
