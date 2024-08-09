import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { asyncQuestionStatus } from '@koh/common'
import { message } from 'antd'

export async function deleteAsyncQuestion(
  questionId: number,
  isStaff: boolean,
  successFunction: () => void,
) {
  await API.asyncQuestions
    .update(questionId, {
      status: isStaff
        ? asyncQuestionStatus.TADeleted
        : asyncQuestionStatus.StudentDeleted,
      visible: false,
    })
    .then(() => {
      message.success(
        isStaff ? 'Removed Question' : 'Question Successfully Deleted',
      )
      successFunction()
    })
    .catch((e) => {
      const errorMessage = getErrorMessage(e)
      message.error('Error deleting question:', errorMessage)
    })
}
