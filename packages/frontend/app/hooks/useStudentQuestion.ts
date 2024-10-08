import { Question } from '@koh/common'
import { SWRResponse } from 'swr'
import { useQuestions } from './useQuestions'
import { useUserInfo } from '../contexts/userContext'

type queueResponse = SWRResponse<Question[], any>

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
  const { userInfo } = useUserInfo()
  const { queueQuestions, questionsError } = useQuestions(qid)

  const studentQuestions =
    userInfo && queueQuestions && queueQuestions?.yourQuestions

  const studentQuestionIndex =
    studentQuestions &&
    queueQuestions.questions.findIndex((question) =>
      studentQuestions.some(
        (studentQuestion) =>
          studentQuestion.id === question.id && !studentQuestion.isTaskQuestion,
      ),
    )
  const studentDemoIndex =
    studentQuestions &&
    queueQuestions.questions.findIndex((question) =>
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
