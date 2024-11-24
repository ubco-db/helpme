import {
  ListQuestionsResponse,
  SSEQueueResponse,
  waitingStatuses,
} from '@koh/common'
import { plainToClass } from 'class-transformer'
import { useCallback, useMemo } from 'react'
import useSWR, { mutate, SWRResponse } from 'swr'
import { useEventSource } from './useEventSource'
import { API } from '../api'

type questionsResponse = SWRResponse<ListQuestionsResponse, any>

interface UseQuestionReturn {
  queueQuestions?: questionsResponse['data']
  questionsError: questionsResponse['error']
  mutateQuestions: questionsResponse['mutate']
}

export function useQuestions(qid: number): UseQuestionReturn {
  const key = `/api/v1/queues/${qid}/questions`
  // Subscribe to sse
  const isLive = useEventSource(
    `/api/v1/queues/${qid}/sse`,
    'question',
    useCallback(
      (data: SSEQueueResponse) => {
        if (data.queueQuestions) {
          mutate(
            key,
            plainToClass(ListQuestionsResponse, data.queueQuestions),
            false,
          )
        }
      },
      [key],
    ),
  )

  const {
    data: queueQuestions,
    error: questionsError,
    mutate: mutateQuestions,
  } = useSWR(key, async () => API.questions.index(qid), {
    refreshInterval: isLive ? 0 : 10 * 1000,
  })

  const sortedQuestions = useMemo(() => {
    if (!queueQuestions?.questions) return []
    // if the question's status is not waiting, the wait time is not moving up, so it stays at whatever it was set at in the database
    // if the question is not being helped, then the wait time in the database is outdated, so it becomes the time since the last time the question was ready
    return queueQuestions.questions
      .map(
        (question) => {
          const now = new Date()
          const lastReadyDate = question.lastReadyAt
            ? typeof question.lastReadyAt === 'string'
              ? new Date(Date.parse(question.lastReadyAt))
              : question.lastReadyAt
            : question.createdAt
              ? typeof question.createdAt === 'string'
                ? new Date(Date.parse(question.createdAt))
                : question.createdAt
              : null
          if (!lastReadyDate) {
            return { ...question, waitTime: 0 }
          }
          const actualWaitTimeSecs = !waitingStatuses.includes(question.status)
            ? question.waitTime
            : question.waitTime +
              Math.round((now.getTime() - lastReadyDate.getTime()) / 1000)
          return { ...question, waitTime: actualWaitTimeSecs }
        },
        // sort by wait time DESC
      )
      .sort((a, b) => b.waitTime - a.waitTime)
  }, [queueQuestions])

  const newQueueQuestions: ListQuestionsResponse = {
    ...queueQuestions,
    questions: sortedQuestions,
    questionsGettingHelp: queueQuestions?.questionsGettingHelp || [],
    yourQuestions: queueQuestions?.yourQuestions || [],
    priorityQueue: queueQuestions?.priorityQueue || [],
    groups: queueQuestions?.groups || [],
    unresolvedAlerts: queueQuestions?.unresolvedAlerts || [],
  }

  return { queueQuestions: newQueueQuestions, questionsError, mutateQuestions }
}
