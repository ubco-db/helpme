import { ListQuestionsResponse, OpenQuestionStatus, Role } from '@koh/common'

export function getHelpingQuestions(
  queueQuestions: ListQuestionsResponse | undefined,
  userId: number,
  role: Role,
) {
  if (role !== Role.TA && role !== Role.PROFESSOR) {
    return { helpingQuestions: [], isHelping: false }
  }
  const helpingQuestions =
    queueQuestions?.questionsGettingHelp.filter(
      (question) =>
        question.status == OpenQuestionStatus.Paused ||
        question.taHelped?.id === userId,
    ) ?? []
  const isHelping = helpingQuestions.length > 0
  return { helpingQuestions, isHelping }
}
