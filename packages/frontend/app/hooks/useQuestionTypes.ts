import useSWR from 'swr'
import { API } from '@koh/api-client'
import { QuestionTypeType } from '@koh/common'

export function useQuestionTypes(
  cid: number,
  qid: number | null,
): [
  QuestionTypeType[] | undefined,
  (
    data?: QuestionTypeType[] | Promise<QuestionTypeType[]>,
    shouldRevalidate?: boolean,
  ) => Promise<QuestionTypeType[] | undefined>,
] {
  const key = `/api/v1/questionType/${cid}/${qid}`

  const { data: questionTypes, mutate } = useSWR(key, async () => {
    return await API.questionType.getQuestionTypes(cid, qid)
  })
  return [questionTypes, mutate]
}
