import {
  ListQuestionsResponse,
  OpenQuestionStatus,
  QueueTypes,
  Role,
} from '@koh/common'

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
        question.status != OpenQuestionStatus.Paused &&
        question.taHelped?.id === userId,
    ) ?? []
  const isHelping = helpingQuestions.length > 0
  return { helpingQuestions, isHelping }
}

export function getPausedQuestions(
  queueQuestions: ListQuestionsResponse | undefined,
  role: Role,
) {
  if (role !== Role.TA && role !== Role.PROFESSOR) {
    return { pausedQuestions: [] }
  }
  const pausedQuestions =
    queueQuestions?.questionsGettingHelp.filter(
      (question) => question.status == OpenQuestionStatus.Paused,
    ) ?? []
  return { pausedQuestions }
}

export const getQueueTypeLabel = (type: QueueTypes) => {
  switch (type) {
    case QueueTypes.Online:
      return 'Online'
    case QueueTypes.Hybrid:
      return 'Hybrid'
    case QueueTypes.InPerson:
      return 'In-Person'
    default:
      return 'Invalid Queue Type'
  }
}
