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

/**
 * Note: This is functionally the same as useQuestions, but it calls different endpoints and has a check if Questions are visible (if not, then no endpoints are called)
 */
export function useQuestionsWithQueueInvite(
  qid: number,
  queueInviteCode: string,
  isQuestionsVisible?: boolean,
): UseQuestionReturn {
  const key = isQuestionsVisible
    ? `/api/v1/queueInvites/${qid}/${queueInviteCode}/questions`
    : null
  // Subscribe to sse
  const isLive = useEventSource(
    isQuestionsVisible
      ? `/api/v1/queueInvites/${qid}/${queueInviteCode}/sse`
      : null,
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
  } = useSWR(
    key,
    async () => API.queueInvites.getQuestions(qid, queueInviteCode),
    {
      refreshInterval: isLive ? 0 : 10 * 1000,
    },
  )

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
