import { GetAsyncQuestionsResponse } from '@koh/common'
import useSWR from 'swr'
import { API } from '../api'

export function useAsyncQuestions(
  cid: number,
): [
  GetAsyncQuestionsResponse | undefined,
  (
    data?:
      | GetAsyncQuestionsResponse
      | Promise<GetAsyncQuestionsResponse>,
    shouldRevalidate?: boolean,
  ) => Promise<GetAsyncQuestionsResponse | undefined>,
] {
  const key = `/api/v1/courses/${cid}/asyncQuestions`

  const { data: asyncQuestions, mutate } = useSWR(key, async () => {
    return await API.asyncQuestions.get(cid)
  })

  return [asyncQuestions, mutate]
}
