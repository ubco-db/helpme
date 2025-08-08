'use client'

import { createContext, ReactNode, useContext } from 'react'

//
// context
//
interface LoginRedirectInfoContextProps {
  invitedOrgId: number | null
  invitedQueueId: number | null
  invitedCourseId: number | null
  invitedCourseInviteCode: string | null
}
const LoginRedirectInfoContext = createContext<LoginRedirectInfoContextProps>({
  invitedOrgId: null,
  invitedQueueId: null,
  invitedCourseId: null,
  invitedCourseInviteCode: null,
})

//
// context provider
//
interface LoginRedirectInfoProviderProps {
  children: ReactNode
  invitedOrgId: number | null
  invitedQueueId: number | null
  invitedCourseId: number | null
  invitedCourseInviteCode: string | null
}

export const LoginRedirectInfoProvider: React.FC<
  LoginRedirectInfoProviderProps
> = ({
  children,
  invitedOrgId,
  invitedQueueId,
  invitedCourseId,
  invitedCourseInviteCode,
}) => {
  return (
    <LoginRedirectInfoContext.Provider
      value={{
        invitedOrgId,
        invitedQueueId,
        invitedCourseId,
        invitedCourseInviteCode,
      }}
    >
      {children}
    </LoginRedirectInfoContext.Provider>
  )
}

/**
 * This hook possibly provides an orgId, courseId, queueId, and courseInviteCode from either a queue invite or a course invite.
 * This is used on the login page to store the organization of the course they were invited to and display it.
 * You can also show other things on the login page with this information.
 */
export const useLoginRedirectInfoProvider =
  (): LoginRedirectInfoContextProps => {
    const context = useContext(LoginRedirectInfoContext)

    if (context === undefined) {
      throw new Error(
        'useLoginRedirectInfoProvider must be used within an LoginRedirectInfoProvider',
      )
    }

    return context
  }
