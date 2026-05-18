'use client'

import { EmbeddableQuestion } from '@koh/common'
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { API } from '@/app/api'
import { message } from 'antd'
import { getErrorMessage } from '@/app/utils/generalUtils'

export interface EmbeddableQuestionContextType {
  setCourseId: React.Dispatch<React.SetStateAction<number | undefined>>,
  setQuestionId: React.Dispatch<React.SetStateAction<number | undefined>>,
  question?: EmbeddableQuestion,
  setQuestion: React.Dispatch<React.SetStateAction<EmbeddableQuestion | undefined>>,
  questions: EmbeddableQuestion[],
  setQuestions: React.Dispatch<React.SetStateAction<EmbeddableQuestion[]>>,
  retrieveQuestions: () => void,
  retrieveQuestion: () => void,
}

const EmbeddableQuestionContext = createContext<EmbeddableQuestionContextType | undefined>(
  undefined,
)

interface EmbeddableQuestionProviderProps {
  children: ReactNode
}

export const EmbeddableQuestionProvider: React.FC<EmbeddableQuestionProviderProps> = ({
  children,
}: EmbeddableQuestionProviderProps) => {
  const [courseId, setCourseId] = useState<number | undefined>()
  const [questionId, setQuestionId] = useState<number | undefined>()
  const [question, setQuestion] = useState<EmbeddableQuestion | undefined>()
  const [questions, setQuestions] = useState<EmbeddableQuestion[]>([])

  const retrieveQuestions = useCallback(async () => {
    if (!courseId) return
    await API.lti.embeddableQuestion.getAll(courseId).then(setQuestions).catch((err) => message.error(getErrorMessage(err)))
  }, [courseId])

  const retrieveQuestion = useCallback(async () => {
    if (!questionId || !courseId) return
    await API.lti.embeddableQuestion.getOne(courseId, questionId).then(setQuestion).catch((err) => message.error(getErrorMessage(err)))
  }, [courseId, questionId])

  useEffect(() => {
    retrieveQuestion().then()
  }, [retrieveQuestion])

  useEffect(() => {
    retrieveQuestions().then()
  }, [retrieveQuestions])

  return (
    <EmbeddableQuestionContext.Provider value={{
      setCourseId,
      setQuestionId,
      question,
      setQuestion,
      questions,
      setQuestions,
      retrieveQuestion,
      retrieveQuestions,
    }}>
      {children}
    </EmbeddableQuestionContext.Provider>
  )
}

export const useEmbeddableQuestion = (): EmbeddableQuestionContextType => {
  const context = useContext(EmbeddableQuestionContext)

  if (context === undefined) {
    throw new Error('useEmbeddableQuestion must be used within an EmbeddableQuestionProvider')
  }

  return context
}
