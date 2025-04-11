import React, { createContext, PropsWithChildren, useContext } from 'react'
import { toast, Toaster } from 'sonner'
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
}

interface AsyncActionsContextProps {
  runAsync: (
    apiCall: () => Promise<any>,
    callback: AsyncCallback,
    notifyOptions?: NotifyOptions,
  ) => void
}

const AsyncActionsContext = createContext<AsyncActionsContextProps>({
  runAsync: () => {
    throw new Error(
      'runAsync() not implemented. Did you forget to wrap your component in AsyncActionsProvider?',
    )
  },
})

export const useAsyncActions = () => useContext(AsyncActionsContext)

export const AsyncActionsProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const runAsync = (
    apiCall: () => Promise<any>,
    callback: AsyncCallback,
    notifyOptions?: NotifyOptions,
  ) => {
    apiCall()
      .then((result) => {
        if (notifyOptions) {
          toast.success(notifyOptions.successMsg, {
            className: 'bg-green-600 text-white',
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
            { className: 'bg-red-600 text-white' },
          )
        } else {
          toast.error(notifyOptions.errorMsg, {
            className: 'bg-red-600 text-white',
          })
        }
        callback(null, error)
      })
  }

  return (
    <AsyncActionsContext.Provider value={{ runAsync }}>
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: 'rounded p-4 text-md font-semibold min-h-18 w-96',
          duration: 5000,
        }}
      />
      {children}
    </AsyncActionsContext.Provider>
  )
}
