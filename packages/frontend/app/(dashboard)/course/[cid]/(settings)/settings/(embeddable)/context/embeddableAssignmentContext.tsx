'use client'

import { EmbeddableAssignment } from '@koh/common'
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { API } from '@/app/api'
import { message } from 'antd'
import { getErrorMessage } from '@/app/utils/generalUtils'

export interface EmbeddableAssignmentContextType {
  setCourseId: React.Dispatch<React.SetStateAction<number | undefined>>,
  setAssignmentId: React.Dispatch<React.SetStateAction<number | undefined>>,
  assignment?: EmbeddableAssignment,
  setAssignment: React.Dispatch<React.SetStateAction<EmbeddableAssignment | undefined>>,
  assignments: EmbeddableAssignment[],
  setAssignments: React.Dispatch<React.SetStateAction<EmbeddableAssignment[]>>,
  retrieveAssignment: () => void,
  retrieveAssignments: () => void,
}

const EmbeddableAssignmentContext = createContext<EmbeddableAssignmentContextType | undefined>(
  undefined,
)

interface EmbeddableAssignmentProviderProps {
  children: ReactNode
}

export const EmbeddableAssignmentProvider: React.FC<EmbeddableAssignmentProviderProps> = ({
  children,
}: EmbeddableAssignmentProviderProps) => {
  const [courseId, setCourseId] = useState<number | undefined>()
  const [assignmentId, setAssignmentId] = useState<number | undefined>()
  const [assignment, setAssignment] = useState<EmbeddableAssignment | undefined>()
  const [assignments, setAssignments] = useState<EmbeddableAssignment[]>([])

  const retrieveAssignments = useCallback(async () => {
    if (!courseId) return
    await API.lti.embeddableQuestion.assignment.getAll(courseId).then(setAssignments).catch((err) => message.error(getErrorMessage(err)))
  }, [courseId])

  const retrieveAssignment = useCallback(async () => {
    if (!assignmentId || !courseId) return
    await API.lti.embeddableQuestion.assignment.getOne(courseId, assignmentId).then(setAssignment).catch((err) => message.error(getErrorMessage(err)))
  }, [courseId, assignmentId])

  useEffect(() => {
    retrieveAssignment().then()
  }, [retrieveAssignment])

  useEffect(() => {
    retrieveAssignments().then()
  }, [retrieveAssignments])

  return (
    <EmbeddableAssignmentContext.Provider value={{
      setCourseId,
      setAssignmentId,
      assignment,
      setAssignment,
      assignments,
      setAssignments,
      retrieveAssignment,
      retrieveAssignments,
    }}>
      {children}
    </EmbeddableAssignmentContext.Provider>
  )
}

export const useEmbeddableAssignment = (): EmbeddableAssignmentContextType => {
  const context = useContext(EmbeddableAssignmentContext)

  if (context === undefined) {
    throw new Error('useEmbeddableAssignment must be used within an EmbeddableAssignmentProvider')
  }

  return context
}
