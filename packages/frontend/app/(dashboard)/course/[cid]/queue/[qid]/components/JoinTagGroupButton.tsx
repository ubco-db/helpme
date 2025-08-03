import { cn, getErrorMessage } from '@/app/utils/generalUtils'
import {
  OpenQuestionStatus,
  Question,
  QuestionLocations,
  QuestionType,
  QuestionTypeParams,
} from '@koh/common'
import { Button, message } from 'antd'
import { Check, LogIn, LogOut } from 'lucide-react'
import { useState } from 'react'

type JoinTagGroupButtonProps = {
  createQuestion: (
    text: string | undefined,
    questionTypes: QuestionType[],
    force: boolean,
    isTaskQuestion: boolean,
    location?: QuestionLocations,
  ) => Promise<void>
  updateQuestion: (
    text: string,
    questionTypes: QuestionTypeParams[],
    groupable: boolean,
    isTaskQuestion: boolean,
    location: QuestionLocations,
  ) => Promise<void>
  leaveQueue: (isTaskQuestion: boolean) => Promise<void>
  studentQuestion?: Question
  studentDemo?: Question
  disabled?: boolean
  isDone?: boolean
  questionType?: QuestionType
  taskId?: string
}

/**
 * Button to join or leave a tag group
 *
 * Please provide **either** a questionType or a taskId
 */
const JoinTagGroupButton: React.FC<JoinTagGroupButtonProps> = ({
  studentQuestion,
  studentDemo,
  createQuestion,
  updateQuestion,
  leaveQueue,
  disabled = false,
  isDone = false,
  questionType,
  taskId,
}) => {
  const [isJoined, setIsJoined] = useState(
    questionType && studentQuestion && studentQuestion.questionTypes
      ? studentQuestion.questionTypes.some((qt) => qt.id === questionType.id)
      : taskId && studentDemo && studentDemo.text
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

  const onClick = async (event: { stopPropagation: () => void }) => {
    event.stopPropagation()
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
            const newQuestionTypes = studentQuestion.questionTypes
              ? [...studentQuestion.questionTypes, questionType]
              : [questionType]

            await updateQuestion(
              studentQuestion.text ?? '',
              newQuestionTypes,
              studentQuestion.groupable,
              studentQuestion.isTaskQuestion ?? false,
              studentQuestion.location ?? QuestionLocations.Unselected,
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
              studentDemo.isTaskQuestion ?? true,
              studentDemo.location ?? QuestionLocations.Unselected,
            )
          }
        } else {
          console.error(
            'Error: This component was used incorrectly. No questionType or taskId provided',
          )
        }
      } else {
        // If leaving the tag group, remove the questionType (for tag) or remove off the task from the question text
        if (questionType) {
          if (!studentQuestion) {
            message.error('Error: Student does not have a question to leave')
            return
          }
          if (
            studentQuestion.text === '' &&
            studentQuestion.questionTypes &&
            studentQuestion.questionTypes.length === 1
          ) {
            await leaveQueue(false)
          } else {
            const newQuestionTypes = studentQuestion.questionTypes
              ? studentQuestion.questionTypes.filter(
                  (qt) => qt.id !== questionType.id,
                )
              : []

            await updateQuestion(
              studentQuestion.text ?? '',
              newQuestionTypes,
              studentQuestion.groupable,
              studentQuestion.isTaskQuestion ?? false,
              studentQuestion.location ?? QuestionLocations.Unselected,
            )
          }
        } else if (taskId) {
          if (!studentDemo) {
            message.error('Error: Student does not have a task to leave')
            return
          }
          if (studentDemo.text === `Mark "${taskId}"`) {
            await leaveQueue(true)
          } else {
            const newQuestionText = studentDemo.text
              ? studentDemo.text.replace(` "${taskId}"`, '')
              : ''
            await updateQuestion(
              newQuestionText,
              [],
              studentDemo.groupable,
              studentDemo.isTaskQuestion ?? true,
              studentDemo.location ?? QuestionLocations.Unselected,
            )
          }
        } else {
          console.error(
            'Error: This component was used incorrectly. No questionType or taskId provided',
          )
        }
      }
      setIsJoined(!isJoined)
    } catch (e) {
      const errorMessage = getErrorMessage(e)
      // The main errors that can be thrown are from createQuestion and updateQuestion, which already display an error message to the user.
      console.error('Error:' + errorMessage)
    }
    setIsLoading(false)
  }

  return (
    <Button
      size="small"
      className={cn(
        'mr-1 flex w-16 flex-nowrap items-center justify-center gap-1 rounded-md border border-gray-200 md:mr-0',
        isDone
          ? '!border-green-600/60 text-[#3D9B3B]'
          : isJoined
            ? '!border-red-500 text-red-500 hover:!border-red-300 hover:text-red-400 focus:!border-red-300 focus:text-red-400'
            : '!border-blue-500 text-[#1480e4] hover:!border-sky-400 hover:text-sky-400 focus:!border-sky-400 focus:text-sky-400',
        isDone ? '' : 'disabled:!border-gray-300 disabled:text-gray-400',
        beingHelped || isDone || disabled
          ? ''
          : isJoined
            ? 'shadow-deep-inner'
            : 'shadow-deep', // box shadow makes button seem "pressed" when joined, and "unpressed" when not joined
        isDone ? '' : 'join-or-leave-tag-group-button',
      )}
      onClick={onClick}
      disabled={beingHelped || isDone || disabled}
      loading={isLoading}
      icon={
        isDone ? (
          <Check size={15} aria-hidden="true" />
        ) : isJoined ? (
          <LogOut
            size={13}
            aria-hidden="true"
            style={{ transform: 'rotate(180deg)' }}
          />
        ) : (
          <LogIn size={15} aria-hidden="true" />
        )
      }
    >
      {isDone ? 'Done' : isJoined ? 'Leave' : 'Join'}
    </Button>
  )
}

export default JoinTagGroupButton
