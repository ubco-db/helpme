'use client';

import type { CourseSettingsResponse, GetCourseResponse } from '@koh/common';
import type { ReactNode } from 'react';
import type React from 'react';
import { createContext, useContext } from 'react';

// Define context type
interface LtiCourseContextType {
  courseId: number;
  course?: GetCourseResponse;
  courseFeatures?: CourseSettingsResponse;
}

// Create context
const ltiCourseContext = createContext<LtiCourseContextType | undefined>(
  undefined,
);

// Define props type for LtiCourseProvider
interface LtiCourseProviderProps {
  children: ReactNode;
  courseId: number;
  course?: GetCourseResponse;
  courseFeatures?: CourseSettingsResponse;
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
  );
};

export const useLtiCourse = (): LtiCourseContextType => {
  const context = useContext(ltiCourseContext);

  if (context === undefined) {
    throw new Error('useLtiCourse must be used within a LtiCourseProvider');
  }

  return context;
};
