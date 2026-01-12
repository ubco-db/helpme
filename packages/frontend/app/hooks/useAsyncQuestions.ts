import { AsyncQuestion } from '@koh/common'
import useSWR from 'swr'
import { API } from '../api'

export function useAsnycQuestions(
  cid: number,
  page: number,
  pageSize: number,
): [
  { questions: AsyncQuestion[]; total: number } | undefined,
  (
    data?:
      | { questions: AsyncQuestion[]; total: number }
      | Promise<{ questions: AsyncQuestion[]; total: number }>,
    shouldRevalidate?: boolean,
  ) => Promise<{ questions: AsyncQuestion[]; total: number } | undefined>,
] {
  const key = `/api/v1/courses/${cid}/asyncQuestions?page=${page}&pageSize=${pageSize}`

  const { data: asyncQuestions, mutate } = useSWR(key, async () => {
    return await API.asyncQuestions.get(cid, page, pageSize)
  })

  return [asyncQuestions, mutate]
}
