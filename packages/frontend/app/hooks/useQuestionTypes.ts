import useSWR from 'swr'
import { API } from '../api'
import { QuestionType } from '@koh/common'

export function useQuestionTypes(
  cid: number,
  qid: number | null,
): [
  QuestionType[] | undefined,
  (
    data?: QuestionType[] | Promise<QuestionType[]>,
    shouldRevalidate?: boolean,
  ) => Promise<QuestionType[] | undefined>,
] {
  const key = `/api/v1/questionType/${cid}/${qid}`

  const { data: questionTypes, mutate } = useSWR(key, async () => {
    return await API.questionType.getQuestionTypes(cid, qid)
  })
  return [questionTypes, mutate]
}
