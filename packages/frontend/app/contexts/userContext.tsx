'use client'

import React, { createContext, useState, useContext, ReactNode } from 'react'

export enum Role {
  STUDENT = 'student',
  INSTRUCTOR = 'instructor',
  ADMIN = 'admin',
}

// Define type for user information
interface UserInfo {
  firstName: string
  lastName: string | null
  email: string | null
  role: Role
  avatarUrl: string | null
}

// Define context type
interface UserInfoContextType {
  userInfo: UserInfo
  setUserInfo: React.Dispatch<React.SetStateAction<UserInfo>>
}

// Create context
const userInfoContext = createContext<UserInfoContextType | undefined>(
  undefined,
)

// Define props type for UserInfoProvider
interface UserInfoProviderProps {
  children: ReactNode
}

export const UserInfoProvider: React.FC<UserInfoProviderProps> = ({
  children,
}: UserInfoProviderProps) => {
  // Define the user state
  const [userInfo, setUserInfo] = useState<UserInfo>({
    firstName: '',
    lastName: '',
    email: null,
    role: Role.INSTRUCTOR,
    avatarUrl: null,
  })

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
