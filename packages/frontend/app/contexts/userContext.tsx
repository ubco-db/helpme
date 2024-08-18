'use client'

import { User } from '@koh/common'
import React, { createContext, useState, useContext, ReactNode } from 'react'

// Define context type
interface UserInfoContextType {
  userInfo: User
  setUserInfo: React.Dispatch<React.SetStateAction<User>>
}

// Create context
const userInfoContext = createContext<UserInfoContextType | undefined>(
  undefined,
)

// Define props type for UserInfoProvider
interface UserInfoProviderProps {
  children: ReactNode
  profile: User
}

export const UserInfoProvider: React.FC<UserInfoProviderProps> = ({
  children,
  profile,
}: UserInfoProviderProps) => {
  // Define the user state
  const [userInfo, setUserInfo] = useState<User>(profile)

  // Return the user state and setUser function
  return (
    <userInfoContext.Provider value={{ userInfo, setUserInfo }}>
      {children}
    </userInfoContext.Provider>
  )
}

export const useUserInfo = (): UserInfoContextType => {
  const context = useContext(userInfoContext)

  if (context === undefined) {
    throw new Error('useUserInfo must be used within a UserInfoProvider')
  }

  return context
}
