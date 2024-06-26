import { Question } from '@koh/common'
import { Button } from 'antd'
import { ReactElement, useState } from 'react'
import styled from 'styled-components'

const CustomButton = styled(Button)<{ isjoined: boolean }>`
  border: 1px solid #cfd6de;
  border-radius: 6px;
  border-color: ${(props) => (props.isjoined ? 'red' : 'green')};
`

export default function JoinTagGroupButton({
  studentQuestion,
  studentDemo,
  tagOrTaskName,
  createQuestion,
  updateQuestion,
  leaveQueue,
}: {
  studentQuestion: Question
  studentDemo: Question
  tagOrTaskName: string
  createQuestion: () => void
  updateQuestion: () => void
  leaveQueue: () => void
}): ReactElement {
  const [isJoined, setIsJoined] = useState(false)

  const finishQuestionOrDemo = useCallback(
    async (
      text: string,
      questionTypes: QuestionTypeParams[],
      groupable: boolean,
      isTaskQuestion: boolean,
      location: string,
    ) => {
      const status = isTaskQuestion ? studentDemoStatus : studentQuestionStatus
      const id = isTaskQuestion ? studentDemoId : studentQuestionId
      const updateStudent = {
        text,
        questionTypes,
        groupable: groupable,
        isTaskQuestion: isTaskQuestion,
        status:
          status === OpenQuestionStatus.Drafting
            ? OpenQuestionStatus.Queued
            : status,
        location,
      }

      const updatedQuestionFromStudent = await API.questions.update(
        id,
        updateStudent,
      )

      const yourUpdatedQuestions = studentQuestions?.map(
        (question: Question) =>
          question.id === id ? updatedQuestionFromStudent : question,
      )

      const newQuestionsInQueue = questions?.queue?.map((question: Question) =>
        question.id === id ? updatedQuestionFromStudent : question,
      )

      mutateQuestions({
        ...questions,
        yourQuestions: yourUpdatedQuestions,
        queue: newQuestionsInQueue,
      })
    },
    [
      studentDemoStatus,
      studentQuestionStatus,
      studentDemoId,
      studentQuestionId,
      studentQuestions,
      questions,
      mutateQuestions,
    ],
  )

  const onClick = () => {
    setIsJoined(!isJoined)
  }

  return (
    <CustomButton size="small" ghost isjoined={isJoined} onClick={onClick}>
      {isJoined ? 'Leave' : 'Join'}
    </CustomButton>
  )
}
