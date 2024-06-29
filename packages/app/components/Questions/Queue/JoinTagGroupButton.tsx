import { Question, QuestionTypeParams, QuestionTypeType } from '@koh/common'
import { Button } from 'antd'
import { ReactElement, useState } from 'react'
import styled from 'styled-components'

const CustomButton = styled(Button)<{ isjoined: string }>`
  border: 1px solid #cfd6de;
  border-radius: 6px;
  border-color: ${(props) => (props.isjoined === 'true' ? 'red' : 'green')};
  color: ${(props) => (props.isjoined === 'true' ? 'red' : 'green')};
`
/**
 * Button to join or leave a tag group
 *
 * Please provide **either** a questionType or a taskId
 */
export default function JoinTagGroupButton({
  studentQuestion,
  studentDemo,
  createQuestion,
  updateQuestion,
  leaveQueue,
  disabled = false,
  questionType,
  taskId,
}: {
  studentQuestion: Question
  studentDemo: Question
  createQuestion: (
    text: string,
    questionTypes: QuestionTypeParams[],
    force: boolean,
    isTaskQuestion: boolean,
  ) => void
  updateQuestion: (
    text: string,
    questionTypes: QuestionTypeParams[],
    groupable: boolean,
    isTaskQuestion: boolean,
    location: string,
  ) => void
  leaveQueue: (isTaskQuestion: boolean) => void
  disabled?: boolean
  questionType?: QuestionTypeType
  taskId?: string
}): ReactElement {
  const [isJoined, setIsJoined] = useState(
    questionType && studentQuestion
      ? studentQuestion.questionTypes.some((qt) => qt.id === questionType.id)
      : taskId && studentDemo
        ? studentDemo.text.includes(` "${taskId}"`)
        : false,
  )

  const onClick = () => {
    setIsJoined(!isJoined)
    if (!isJoined) {
      if (questionType) {
        if (!studentQuestion) {
          // if student doesn't already have a question, create one
          createQuestion('', [questionType], false, false)
        } else {
          // if the student already has a question, update it with the new question type appended
          const newQuestionTypes = [
            ...studentQuestion.questionTypes,
            questionType,
          ]
          updateQuestion(
            studentQuestion.text,
            newQuestionTypes,
            studentQuestion.groupable,
            studentQuestion.isTaskQuestion,
            studentQuestion.location,
          )
        }
      } else if (taskId) {
        // basically the same thing, but with tasks
        if (!studentDemo) {
          // tasks get put as "Mark "taskId" "taskId2" and have no questionTypes
          createQuestion(`Mark "${taskId}"`, [], false, true)
        } else {
          const newQuestionText = studentDemo.text + ` "${taskId}"`
          updateQuestion(
            newQuestionText,
            [],
            studentDemo.groupable,
            studentDemo.isTaskQuestion,
            studentDemo.location,
          )
        }
      } else {
        console.log(
          'Error: This component was used incorrectly. No questionType or taskId provided',
        )
      }
    } else {
      // If leaving the tag group, remove the questionType (for tag) or remove off the task from the question text
      if (questionType) {
        if (!studentQuestion) {
          console.log('Error: Student does not have a question to leave')
          return
        }
        if (
          studentQuestion.text === '' &&
          studentQuestion.questionTypes.length === 1
        ) {
          leaveQueue(false)
        } else {
          const newQuestionTypes = studentQuestion.questionTypes.filter(
            (qt) => qt.id !== questionType.id,
          )
          updateQuestion(
            studentQuestion.text,
            newQuestionTypes,
            studentQuestion.groupable,
            studentQuestion.isTaskQuestion,
            studentQuestion.location,
          )
        }
      } else if (taskId) {
        if (!studentDemo) {
          console.log('Error: Student does not have a task to leave')
          return
        }
        if (studentDemo.text === `Mark "${taskId}"`) {
          leaveQueue(true)
        } else {
          const newQuestionText = studentDemo.text.replace(` "${taskId}"`, '')
          updateQuestion(
            newQuestionText,
            [],
            studentDemo.groupable,
            studentDemo.isTaskQuestion,
            studentDemo.location,
          )
        }
      } else {
        console.log(
          'Error: This component was used incorrectly. No questionType or taskId provided',
        )
      }
    }
  }

  return (
    <CustomButton
      size="small"
      isjoined={isJoined.toString()}
      onClick={onClick}
      disabled={disabled}
    >
      {isJoined ? 'Leave' : 'Join'}
    </CustomButton>
  )
}
