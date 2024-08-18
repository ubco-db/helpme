'use client'

import { createContext, ReactNode, useContext, useState } from 'react'

interface OrganizationContextProps {
  organizationIdForInvitedCourse: number | null
}

const OrganizationContext = createContext<OrganizationContextProps>({
  organizationIdForInvitedCourse: null,
})

interface OrganizationProviderForInvitedCourseProps {
  children: ReactNode
  organizationIdForInvitedCourse: number | null
}

export const OrganizationProviderForInvitedCourse: React.FC<
  OrganizationProviderForInvitedCourseProps
> = ({ children, organizationIdForInvitedCourse }) => {
  return (
    <OrganizationContext.Provider value={{ organizationIdForInvitedCourse }}>
      {children}
    </OrganizationContext.Provider>
  )
}

/**
 * This hook provides an organizationId. This is used on the login page to store the organization of the course they were invited to.
 */
export const useOrganizationProviderForInvitedCourse =
  (): OrganizationContextProps => {
    const context = useContext(OrganizationContext)

    if (context === undefined) {
      throw new Error(
        'useOrganization must be used within an OrganizationProvider',
      )
    }

    return context
  }
