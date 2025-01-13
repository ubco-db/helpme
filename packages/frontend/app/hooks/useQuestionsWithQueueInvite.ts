import { ListQuestionsResponse, SSEQueueResponse } from '@koh/common'
import { plainToClass } from 'class-transformer'
import { useCallback, useMemo } from 'react'
import useSWR, { mutate, SWRResponse } from 'swr'
import { useEventSource } from './useEventSource'
import { API } from '../api'
import { updateWaitTime } from '../utils/timeFormatUtils'

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

  //
  // frontend dataprocessing logic.
  // This is here since the response from the backend and/or database is cached
  // and we want the waitTime to be updated more often.
  // This should basically have the same performance as putting these calculations in the getWaitTime in timeFormatUtils since the same calcs are being made.
  //
  const sortedQuestions = useMemo(() => {
    if (!queueQuestions?.questions) return []
    return (
      queueQuestions.questions
        .map((question) => updateWaitTime(question))
        // sort by wait time DESC
        .sort((a, b) => b.waitTime - a.waitTime)
    )
  }, [queueQuestions])

  const questionsGettingHelpWithWaitTime = useMemo(() => {
    if (!queueQuestions?.questionsGettingHelp) return []
    return queueQuestions.questionsGettingHelp.map((question) =>
      updateWaitTime(question),
    )
  }, [queueQuestions])

  const newQueueQuestions: ListQuestionsResponse = {
    ...queueQuestions,
    questions: sortedQuestions,
    questionsGettingHelp: questionsGettingHelpWithWaitTime,
    yourQuestions: [], // this is public data. There are no yourQuestions
    priorityQueue: queueQuestions?.priorityQueue || [],
    groups: queueQuestions?.groups || [],
    unresolvedAlerts: queueQuestions?.unresolvedAlerts || [],
  }

  return { queueQuestions: newQueueQuestions, questionsError, mutateQuestions }
}
