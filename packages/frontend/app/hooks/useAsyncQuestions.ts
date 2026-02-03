import { AsyncQuestion } from '@koh/common'
import useSWR from 'swr'
import { API } from '../api'

export function useAsyncQuestions(
  cid: number,
): [
  AsyncQuestion[] | undefined,
  (
    data?: AsyncQuestion[] | Promise<AsyncQuestion[]>,
    shouldRevalidate?: boolean,
  ) => Promise<AsyncQuestion[] | undefined>,
] {
  const key = `/api/v1/courses/${cid}/asyncQuestions`

  const { data: asyncQuestions, mutate } = useSWR(key, async () => {
    return await API.asyncQuestions.get(cid)
  })

  return [asyncQuestions, mutate]
}
