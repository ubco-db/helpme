import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { asyncQuestionStatus } from '@koh/common'
import { message } from 'antd'

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
