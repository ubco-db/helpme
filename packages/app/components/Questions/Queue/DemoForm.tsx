import {
  QuestionTypeParams,
  OpenQuestionStatus,
  Question,
  StudentAssignmentProgress,
} from '@koh/common'
import { Alert, Button, Input, Modal, Radio, Tooltip } from 'antd'
import { NextRouter, useRouter } from 'next/router'
import {
  default as React,
  ReactElement,
  useCallback,
  useEffect,
  useState,
} from 'react'
import styled from 'styled-components'
import { useLocalStorage } from '../../../hooks/useLocalStorage'
import { toOrdinal } from '../../../utils/ordinal'
import { API } from '@koh/api-client'
import PropTypes from 'prop-types'
import { TaskSelector } from './TaskSelector'

const Container = styled.div`
  max-width: 960px;
`

const QuestionText = styled.div`
  font-weight: normal;
  font-size: 14px;
  line-height: 22px;
  margin-bottom: 4px;
`

const QuestionCaption = styled.div`
  font-weight: 300;
  font-size: 14px;
  line-height: 22px;
  color: #8c8c8c;
  margin-bottom: 32px;
`

const FormButton = styled(Button)`
  margin-left: 8px;
`

const SaveChangesButton = styled(Button)`
  margin-left: 8px;
  background: #3684c6;
`

interface DemoFormProps {
  configTasks: object
  studentAssignmentProgress: StudentAssignmentProgress
  visible: boolean
  question: Question
  queueId: number
  leaveQueue: () => void
  finishDemo: (
    text: string,
    questionType: QuestionTypeParams[],
    router: NextRouter,
    courseId: number,
    location: string,
    isTaskQuestion: boolean,
    groupable?: boolean,
  ) => void
  position: number
  cancel: () => void
}

export default function DemoForm({
  configTasks,
  studentAssignmentProgress,
  visible,
  question,
  leaveQueue,
  finishDemo,
  position,
  cancel,
  queueId,
}: DemoFormProps): ReactElement {
  const [storageQuestion, setStoredQuestion] = useLocalStorage(
    'draftDemo',
    null,
  )
  const router = useRouter()
  const courseId = router.query['cid']

  const drafting = question?.status === OpenQuestionStatus.Drafting
  const helping = question?.status === OpenQuestionStatus.Helping

  const [questionText, setQuestionText] = useState<string>(question?.text || '')

  // const [tasksInput, setTasksInput] = useState<string>(question?.questionTypes || [])
  const [tasksInput, setTasksInput] = useState<string[]>(
    question?.text?.match(/"(.*?)"/g)?.map((task) => task.slice(1, -1)) || [],
  ) // gives an array of "part1","part2",etc.)

  useEffect(() => {
    if (question && !visible) {
      setQuestionText(question.text)
      setTasksInput(
        question.text.match(/"(.*?)"/g)?.map((task) => task.slice(1, -1)) || [],
      )
    }
  }, [question, visible])

  const onTaskChange = (newTasks: string[]) => {
    setTasksInput(newTasks)

    // set question text to be "Mark "task1" "task2"..."
    const newQuestionText = `Mark ${newTasks
      .map((task) => `"${task}"`)
      .join(' ')}`
    setQuestionText(newQuestionText)

    const questionFromStorage = storageQuestion ?? {}
    setStoredQuestion({
      id: question?.id,
      ...questionFromStorage,
      text: questionText,
    })
  }

  // on button submit click, conditionally choose to go back to the queue
  const onClickSubmit = () => {
    finishDemo(
      questionText,
      [], // no question types for demos
      router,
      Number(courseId),
      'In Person', // for now, all demos are in person
      true, //isTaskQuestion
      false, //groupable
    )
  }

  // TODO: need to make it so that when the demo is succesfully marked, to make sure to clear the storage

  // all possible questions, use courseId
  const courseNumber = Number(courseId)
  const getQuestions = useCallback(() => {
    let isCancelled = false

    // const fetchQuestions = async () => {
    //   const questions = await API.questionType.getQuestionTypes(
    //     courseNumber,
    //     queueId,
    //   )
    //   if (!isCancelled) {
    //     setQuestionsTypeState(questions)
    //   }
    // }

    // fetchQuestions()

    return () => {
      isCancelled = true
    }
  }, [courseNumber])

  useEffect(() => {
    const cleanup = getQuestions()
    return () => {
      cleanup()
    }
  }, [getQuestions])

  return (
    <Modal
      open={visible}
      closable={true}
      onCancel={() => {
        setStoredQuestion(question)
        cancel()
      }}
      title={drafting ? 'Create Demo' : 'Edit Your Demo'}
      footer={
        <div>
          {drafting ? (
            <FormButton danger onClick={leaveQueue}>
              Leave Queue
            </FormButton>
          ) : (
            <FormButton onClick={cancel}>Cancel</FormButton>
          )}
          <Tooltip
            title={
              tasksInput.length < 1 ? 'You must select at least one task' : null
            }
          >
            <SaveChangesButton
              type="primary"
              disabled={tasksInput.length < 1} // must select at least one task
              onClick={onClickSubmit}
            >
              {drafting ? 'Finish' : 'Save Changes'}
            </SaveChangesButton>
          </Tooltip>
        </div>
      }
    >
      <Container>
        {drafting && (
          <Alert
            style={{ marginBottom: '1rem' }}
            message={`You are currently ${toOrdinal(position)} in queue`}
            description="Your spot in queue has been temporarily reserved. Please select what parts you want checked to finish joining the queue."
            type="success"
            showIcon
          />
        )}
        {helping && (
          <Alert
            style={{ marginBottom: '1rem' }}
            message={`A TA is coming to help you`}
            description="Please click 'Save Changes' to submit what you've filled out"
            type="info"
            showIcon
          />
        )}
        {Object.keys(configTasks).length > 0 ? (
          <section>
            <QuestionText id="question-type-text">
              What parts are being checked?
            </QuestionText>
            <TaskSelector
              studentAssignmentProgress={studentAssignmentProgress}
              configTasks={configTasks}
              onChange={onTaskChange}
              // value={questionTypeInput.map((type) => type.id)}
              value={tasksInput}
              // questionTypes={questionsTypeState}
              className="mb-4"
              ariaLabelledBy="question-type-text"
            ></TaskSelector>
          </section>
        ) : (
          <p>No Tasks Found. Please let your TA/Prof know of this issue</p>
        )}
      </Container>
    </Modal>
  )
}
