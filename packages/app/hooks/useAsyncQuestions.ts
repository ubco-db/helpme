import { API } from '@koh/api-client'
import { AsyncQuestion } from '@koh/common'

import useSWR, { responseInterface } from 'swr'
type questionsResponse = responseInterface<AsyncQuestion[], any>

interface UseQuestionReturn {
  questions?: questionsResponse['data']
  questionsError: questionsResponse['error']
  mutateQuestions: questionsResponse['mutate']
}

export function useAsnycQuestions(cid: number): UseQuestionReturn {
  const key = cid && `/api/v1/courses/${cid}/asyncQuestions`

  const {
    data: questions,
    error: questionsError,
    mutate: mutateQuestions,
  } = useSWR(key, async () => API.course.getAsyncQuestions(Number(cid)), {
    refreshInterval: 0,
  })

  return { questions, questionsError, mutateQuestions }
}
