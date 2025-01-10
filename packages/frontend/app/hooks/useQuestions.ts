import { ListQuestionsResponse, SSEQueueResponse } from '@koh/common'
import { plainToClass } from 'class-transformer'
import { useCallback, useEffect, useMemo } from 'react'
import useSWR, { mutate, SWRResponse, useSWRConfig } from 'swr'
import { useEventSource } from './useEventSource'
import { API } from '../api'
import { updateWaitTime } from '../utils/timeFormatUtils'
import isEqual from 'lodash/isEqual'

type questionsResponse = SWRResponse<ListQuestionsResponse, any>

interface UseQuestionReturn {
  queueQuestions?: questionsResponse['data']
  questionsError: questionsResponse['error']
  mutateQuestions: questionsResponse['mutate']
}

export function useQuestions(qid: number): UseQuestionReturn {
  // log when qid changes
  useEffect(() => {
    console.log('QID changed', qid)
  }, [qid])
  const key = `/api/v1/queues/${qid}/questions`

  // Access SWR's global cache
  const { cache } = useSWRConfig()

  // Subscribe to SSE
  const isLive = useEventSource(
    `/api/v1/queues/${qid}/sse`,
    'question',
    useCallback(
      (data: SSEQueueResponse) => {
        if (!data.queueQuestions) return

        // Convert incoming SSE data
        const newQuestions = plainToClass(
          ListQuestionsResponse,
          data.queueQuestions,
        )

        // Compare against current cache
        const current = cache.get(key)
        if (!isEqual(current?.data, newQuestions)) {
          console.log("It's changed!")
          console.log(current)
          console.log(newQuestions)
          mutate(key, newQuestions, false)
        }
      },
      [key, cache],
    ),
  )

  const {
    data: queueQuestions,
    error: questionsError,
    mutate: mutateQuestions,
  } = useSWR<ListQuestionsResponse>(key, async () => API.questions.index(qid), {
    refreshInterval: isLive ? 0 : 10_000,
    // Optional: compare on fetch success too
    onSuccess: async (fetchedData, swrKey) => {
      const newQuestions = plainToClass(ListQuestionsResponse, fetchedData)
      const current = cache.get(swrKey)
      if (!isEqual(current?.data, newQuestions)) {
        console.log("It's changed!")
        console.log(current)
        console.log(newQuestions)
        mutate(swrKey, newQuestions, false)
      }
    },
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

  // log when queue changes
  useEffect(() => {
    console.log('Queuequestuions changed', newQueueQuestions)
  }, [newQueueQuestions])

  return { queueQuestions: newQueueQuestions, questionsError, mutateQuestions }
}
