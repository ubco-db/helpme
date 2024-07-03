import { CheckOutlined } from '@ant-design/icons'
import {
  OpenQuestionStatus,
  Question,
  QuestionTypeParams,
  QuestionTypeType,
} from '@koh/common'
import { Button, message } from 'antd'
import { Check, LogIn, LogOut } from 'lucide-react'
import { ReactElement, useState } from 'react'
import styled from 'styled-components'

const CustomButton = styled(Button)<{ colorstyle: string }>`
  display: flex;
  flex-wrap: nowrap;
  justify-content: center;
  align-items: center;
  width: 4rem;
  border: 1px solid #cfd6de;
  border-radius: 6px;
  border-color: ${(props) =>
    props.colorstyle === 'Done'
      ? '#3D9B3B !important'
      : props.colorstyle === 'Leave'
        ? 'red'
        : '#1480e4'};
  color: ${(props) =>
    props.colorstyle === 'Done'
      ? '#3D9B3B !important'
      : props.colorstyle === 'Leave'
        ? 'red'
        : '#1480e4'};
  // box shadow makes button seem "pressed" when joined, and "unpressed" when not joined
  box-shadow: ${(props) => (props.colorstyle === 'Leave' ? 'inset' : '')} 0 4px
    4px rgba(0, 0, 0, 0.25);
  // change hover colors to be light green/red as opposed to blue
  &:hover,
  &:focus {
    border-color: ${(props) =>
      props.colorstyle === 'Leave' ? 'lightcoral' : 'deepskyblue'};
    color: ${(props) =>
      props.colorstyle === 'Leave' ? 'lightcoral' : 'deepskyblue'};
  }
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
  isDone = false,
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
  ) => Promise<void>
  updateQuestion: (
    text: string,
    questionTypes: QuestionTypeParams[],
    groupable: boolean,
    isTaskQuestion: boolean,
    location: string,
  ) => Promise<void>
  leaveQueue: (isTaskQuestion: boolean) => Promise<void>
  disabled?: boolean
  isDone?: boolean
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
  const [isLoading, setIsLoading] = useState(false)

  // just used to disable the button so students can't modify their question while being helped
  const beingHelped =
    (questionType &&
      studentQuestion &&
      studentQuestion.status === OpenQuestionStatus.Helping) ||
    (taskId && studentDemo && studentDemo.status === OpenQuestionStatus.Helping)

  const onClick = async () => {
    setIsLoading(true)
    const isJoining = !isJoined
    try {
      if (isJoining) {
        if (questionType) {
          if (!studentQuestion) {
            // if student doesn't already have a question, create one
            await createQuestion('', [questionType], false, false)
          } else {
            // if the student already has a question, update it with the new question type appended
            const newQuestionTypes = [
              ...studentQuestion.questionTypes,
              questionType,
            ]
            await updateQuestion(
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
            await createQuestion(`Mark "${taskId}"`, [], false, true)
          } else {
            const newQuestionText = studentDemo.text + ` "${taskId}"`
            await updateQuestion(
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
            await leaveQueue(false)
          } else {
            const newQuestionTypes = studentQuestion.questionTypes.filter(
              (qt) => qt.id !== questionType.id,
            )
            await updateQuestion(
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
            await leaveQueue(true)
          } else {
            const newQuestionText = studentDemo.text.replace(` "${taskId}"`, '')
            await updateQuestion(
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
      setIsJoined(!isJoined)
    } catch (e) {
      message.error(e.response?.data?.message || 'An unexpected error occurred')
    }
    setIsLoading(false)
  }

  return (
    <CustomButton
      size="small"
      className={isDone ? '' : 'join-or-leave-tag-group-button'}
      colorstyle={isDone ? 'Done' : isJoined ? 'Leave' : 'Join'}
      onClick={onClick}
      disabled={beingHelped || isDone || disabled}
      loading={isLoading}
      icon={
        isDone ? (
          <Check size={15} aria-hidden="true" className="mr-1 shrink-0" />
        ) : isJoined ? (
          <LogOut
            size={13}
            aria-hidden="true"
            style={{ transform: 'rotate(180deg)' }}
            className="mr-1 shrink-0"
          />
        ) : (
          <LogIn size={15} aria-hidden="true" className="mr-1 shrink-0" />
        )
      }
    >
      {isDone ? 'Done' : isJoined ? 'Leave' : 'Join'}
    </CustomButton>
  )
}
