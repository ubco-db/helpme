import { useLocalStorage } from './useLocalStorage'
import { Question } from '@koh/common'

interface UseDraftQuestionResult {
  draftQuestion: Question
  setDraftQuestion: (q: Question) => void
  deleteDraftQuestion: () => void
}
// bro this is only used in 1 place
export function useDraftQuestion(): UseDraftQuestionResult {
  const [draftQuestion, setDraftQuestion, deleteDraftQuestion] =
    useLocalStorage('draftQuestion', null)
  return {
    draftQuestion,
    setDraftQuestion,
    deleteDraftQuestion: (): void => deleteDraftQuestion(),
  }
}
