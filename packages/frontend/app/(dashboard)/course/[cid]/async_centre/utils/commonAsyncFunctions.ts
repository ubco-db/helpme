import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { asyncQuestionStatus } from '@koh/common'
import { message } from 'antd'
import { ANONYMOUS_ANIMAL_AVATAR } from '@/app/utils/constants'

/**
 * This function used to make more sense when students and staff called the same endpoint.
 * Maybe splitting this into two functions could be a thing that could be done at some point TODO .
 */
export async function deleteAsyncQuestion(
  questionId: number,
  isStaff: boolean,
  successFunction: () => void,
) {
  if (isStaff) {
    await API.asyncQuestions
      .facultyUpdate(questionId, {
        status: asyncQuestionStatus.TADeleted,
        visible: false,
      })
      .then(() => {
        message.success('Removed Question')
        successFunction()
      })
      .catch((e) => {
        const errorMessage = getErrorMessage(e)
        message.error('Error deleting question:' + errorMessage)
      })
  } else {
    await API.asyncQuestions
      .studentUpdate(questionId, {
        status: asyncQuestionStatus.StudentDeleted,
        visible: false,
      })
      .then(() => {
        message.success('Question Successfully Deleted')
        successFunction()
      })
      .catch((e) => {
        const errorMessage = getErrorMessage(e)
        message.error('Error deleting question:' + errorMessage)
      })
  }
}

export function getAnonAnimal(anonId: number) {
  return ANONYMOUS_ANIMAL_AVATAR.ANIMAL_NAMES[anonId]
}

/**
 * Takes in a userId and questionId and hashes them to return a random index from ANONYMOUS_ANIMAL_AVATAR.ANIMAL_NAMES
 */
export function getAnonId(userId: number, questionId: number) {
  const hash = userId + questionId
  return hash % ANONYMOUS_ANIMAL_AVATAR.ANIMAL_NAMES.length
}

// export function getAnonNumber(userId: number, questionId: number) {
//   const hash = userId + questionId
//   return (hash % 99) + 1
// }
