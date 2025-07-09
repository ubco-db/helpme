import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { asyncQuestionStatus, Role } from '@koh/common'
import { message } from 'antd'
import { ANONYMOUS_ANIMAL_AVATAR } from '@/app/utils/constants'
import { CommentAuthorType } from './types'

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
        staffSetVisible: false,
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
        authorSetVisible: false,
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
 * This just returns the tooltip that shows on their avatars, it's used in AsyncQuestionCard and Comment
 */
export function getAvatarTooltip(
  IAmStaff: boolean,
  showStudents: boolean,
  commenterRole: CommentAuthorType,
) {
  if (commenterRole === 'you' && IAmStaff) {
    return 'Since you are a staff member, students in the course can see who you are.'
  } else if (
    (commenterRole === Role.STUDENT || commenterRole === 'author') &&
    IAmStaff &&
    !showStudents
  ) {
    return `All students posts and comments are anonymized to other students (They get a different anonymous animal on each question).
     Since you are staff, you can click to reveal who they are.`
  } else if (
    (commenterRole === Role.STUDENT || commenterRole === 'author') &&
    IAmStaff &&
    showStudents
  ) {
    return ''
  } else if (!IAmStaff && commenterRole === Role.STUDENT) {
    return `All students posts and comments are anonymized to other students (They get a different anonymous animal on each question).`
  } else if (!IAmStaff && commenterRole === 'author') {
    return 'All students posts and comments are anonymized to other students (They get a different anonymous animal on each question). This is the author of this question.'
  } else if (!IAmStaff && commenterRole === 'you') {
    return 'All of your posts and comments are anonymized to other students (You get a different anonymous animal on each question). You are this animal for this question.'
  } else {
    return ''
  }
}
