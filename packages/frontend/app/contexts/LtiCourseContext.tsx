'use client'

import { CourseSettingsResponse, GetCourseResponse } from '@koh/common'
import React, { createContext, ReactNode, useContext } from 'react'

// Define context type
interface LtiCourseContextType {
  courseId: number
  course?: GetCourseResponse
  courseFeatures?: CourseSettingsResponse
}

// Create context
const ltiCourseContext = createContext<LtiCourseContextType | undefined>(
  undefined,
)

// Define props type for LtiCourseProvider
interface LtiCourseProviderProps {
  children: ReactNode
  courseId: number
  course?: GetCourseResponse
  courseFeatures?: CourseSettingsResponse
}

export const LtiCourseProvider: React.FC<LtiCourseProviderProps> = ({
  children,
  courseId,
  course,
  courseFeatures,
}: LtiCourseProviderProps) => {
  // Return the user state and setUser function
  return (
    <ltiCourseContext.Provider value={{ courseId, course, courseFeatures }}>
      {children}
    </ltiCourseContext.Provider>
  )
}

export const useLtiCourse = (dynamic?: boolean): LtiCourseContextType => {
  const context = useContext(ltiCourseContext)

  if (context === undefined && !dynamic) {
    throw new Error('useLtiCourse must be used within a LtiCourseProvider')
  }

  return context
}
