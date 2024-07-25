import { Question } from '@koh/common'
import { responseInterface } from 'swr'
import { useProfile } from './useProfile'
import { useQuestions } from './useQuestions'

type queueResponse = responseInterface<Question[], any>

interface UseStudentQuestionReturn {
  studentQuestion?: Question
  studentDemo?: Question
  studentQuestions?: queueResponse['data']
  studentQuestionIndex?: number
  studentDemoIndex?: number
  studentQuestionError: queueResponse['error']
  // mutateStudentQuestion: (q: Question) => void;
}

/**
 * SWR wrapper for the questions of the currently logged-in student
 */
export function useStudentQuestion(qid: number): UseStudentQuestionReturn {
  const profile = useProfile()
  const { questions, questionsError } = useQuestions(qid)

  const studentQuestions = profile && questions && questions?.yourQuestions

  const studentQuestionIndex =
    studentQuestions &&
    questions.queue.findIndex((question) =>
      studentQuestions.some(
        (studentQuestion) =>
          studentQuestion.id === question.id && !studentQuestion.isTaskQuestion,
      ),
    )
  const studentDemoIndex =
    studentQuestions &&
    questions.queue.findIndex((question) =>
      studentQuestions.some(
        (studentQuestion) =>
          studentQuestion.id === question.id && studentQuestion.isTaskQuestion,
      ),
    )

  const studentQuestion = studentQuestions?.find(
    (question) => !question.isTaskQuestion,
  )
  const studentDemo = studentQuestions?.find(
    (question) => question.isTaskQuestion,
  )

  return {
    studentQuestion,
    studentDemo,
    studentQuestions,
    studentQuestionIndex,
    studentDemoIndex,
    studentQuestionError: questionsError,
  }
}
