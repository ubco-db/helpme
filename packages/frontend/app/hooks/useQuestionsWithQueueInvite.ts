import { ListQuestionsResponse, SSEQueueResponse } from '@koh/common'
import { plainToClass } from 'class-transformer'
import { useCallback } from 'react'
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
  return { queueQuestions, questionsError, mutateQuestions }
}
