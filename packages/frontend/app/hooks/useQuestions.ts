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

  const yourQuestionsWithWaitTime = useMemo(() => {
    if (!queueQuestions?.yourQuestions) return []
    return queueQuestions.yourQuestions.map((question) =>
      updateWaitTime(question),
    )
  }, [queueQuestions])

  // priority queue is unused right now, save some calcs
  // const priorityQueueWithWaitTime = useMemo(() => {
  //   if (!queueQuestions?.priorityQueue) return []
  //   return queueQuestions.priorityQueue.map((question) => {
  //     return updateWaitTime(question)
  //   })
  // }, [queueQuestions])

  const newQueueQuestions: ListQuestionsResponse = {
    ...queueQuestions,
    questions: sortedQuestions,
    questionsGettingHelp: questionsGettingHelpWithWaitTime,
    yourQuestions: yourQuestionsWithWaitTime,
    priorityQueue: queueQuestions?.priorityQueue || [],
    groups: queueQuestions?.groups || [],
    unresolvedAlerts: queueQuestions?.unresolvedAlerts || [],
  }

  return { queueQuestions: newQueueQuestions, questionsError, mutateQuestions }
}
