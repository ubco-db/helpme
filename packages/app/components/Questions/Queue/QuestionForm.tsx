import { QuestionTypeParams, OpenQuestionStatus, Question } from '@koh/common'
import { Alert, Button, Input, Modal, Radio } from 'antd'
import { RadioChangeEvent } from 'antd/lib/radio'
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
import { QuestionTypeSelector } from '../Shared/QuestionType'
import PropTypes from 'prop-types'

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

interface QuestionFormProps {
  visible: boolean
  question: Question
  queueId: number
  leaveQueue: () => void
  finishQuestion: (
    text: string,
    questionType: QuestionTypeParams[],
    router: NextRouter,
    courseId: number,
    location: string,
  ) => void
  position: number
  cancel: () => void
}

QuestionForm.propTypes = {
  value: PropTypes.any.isRequired,
  onClose: PropTypes.func.isRequired,
}

export default function QuestionForm({
  visible,
  question,
  leaveQueue,
  finishQuestion,
  position,
  cancel,
  queueId,
}: QuestionFormProps): ReactElement {
  const [storageQuestion, setStoredQuestion] = useLocalStorage(
    'draftQuestion',
    null,
  )
  const router = useRouter()
  const courseId = router.query['cid']

  const drafting = question?.status === OpenQuestionStatus.Drafting
  const helping = question?.status === OpenQuestionStatus.Helping
  const [questionsTypeState, setQuestionsTypeState] = useState<
    QuestionTypeParams[]
  >([])
  const [questionTypeInput, setQuestionTypeInput] = useState<
    QuestionTypeParams[]
  >(question?.questionTypes || [])
  const [questionText, setQuestionText] = useState<string>(question?.text || '')

  const [inperson, setInperson] = useState<boolean>(false)

  useEffect(() => {
    if (question && !visible) {
      setQuestionText(question.text)
      setQuestionTypeInput(question.questionTypes)
    }
  }, [question, visible])

  const onTypeChange = (selectedIds: number[]) => {
    const newQuestionTypeInput: QuestionTypeParams[] =
      questionsTypeState.filter((questionType) =>
        selectedIds.includes(questionType.id),
      )

    setQuestionTypeInput(newQuestionTypeInput)

    const questionFromStorage = storageQuestion ?? {}

    setStoredQuestion({
      id: question?.id,
      ...questionFromStorage,
      questionTypes: newQuestionTypeInput,
    })
  }

  // on question text change, update the question text state
  const onQuestionTextChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setQuestionText(event.target.value)

    const questionFromStorage = storageQuestion ?? {}
    setStoredQuestion({
      id: question?.id,
      ...questionFromStorage,
      text: event.target.value,
    })
  }

  const onLocationChange = (e: RadioChangeEvent) => {
    setInperson(e.target.value)
    const questionFromStorage = storageQuestion ?? {}
    setStoredQuestion({
      id: question?.id,
      ...questionFromStorage,
      location: inperson ? 'In Person' : 'Online',
    })
  }
  // on button submit click, conditionally choose to go back to the queue
  const onClickSubmit = () => {
    if (questionTypeInput) {
      finishQuestion(
        questionText,
        questionTypeInput,
        router,
        Number(courseId),
        inperson ? 'In Person' : 'Online',
      )
    }
  }

  // all possible questions, use courseId
  const courseNumber = Number(courseId)
  const getQuestions = useCallback(() => {
    let isCancelled = false

    const fetchQuestions = async () => {
      const questions = await API.questionType.getQuestionTypes(
        courseNumber,
        queueId,
      )
      if (!isCancelled) {
        setQuestionsTypeState(questions)
      }
    }

    fetchQuestions()

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
      title={drafting ? 'Describe your question' : 'Edit your question'}
      footer={
        <div>
          {drafting ? (
            <FormButton danger onClick={leaveQueue}>
              Leave Queue
            </FormButton>
          ) : (
            <FormButton onClick={cancel}>Cancel</FormButton>
          )}
          <SaveChangesButton
            type="primary"
            disabled={!questionTypeInput}
            onClick={onClickSubmit}
          >
            {drafting ? 'Finish' : 'Save Changes'}
          </SaveChangesButton>
        </div>
      }
    >
      <Container>
        {drafting && (
          <Alert
            style={{ marginBottom: '1rem' }}
            message={`You are currently ${toOrdinal(position)} in queue`}
            description="Your spot in queue has been temporarily reserved. Please describe your question to finish joining the queue."
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
        {questionsTypeState.length > 0 ? (
          <section>
            <QuestionText id="question-type-text">
              What categories does your question fall under?
            </QuestionText>
            <QuestionTypeSelector
              onChange={onTypeChange}
              value={questionTypeInput.map((type) => type.id)}
              questionTypes={questionsTypeState}
              className="mb-4"
              ariaLabelledBy="question-type-text"
            ></QuestionTypeSelector>
          </section>
        ) : (
          <p>No Question types found</p>
        )}
        <section>
          <QuestionText id="question-form-text">
            What do you need help with?
          </QuestionText>
          <Input.TextArea
            value={questionText}
            placeholder="I’m having trouble understanding list abstractions, particularly in Assignment 5."
            autoSize={{ minRows: 3, maxRows: 6 }}
            onChange={onQuestionTextChange}
            aria-labelledby="question-form-text"
            aria-describedby="question-form-text-caption"
          />
          <QuestionCaption id="question-form-text-caption">
            Be as descriptive and specific as possible in your answer. Your name
            will be hidden to other students, but your question will be visible
            so don&apos;t frame your question in a way that gives away the
            answer.
          </QuestionCaption>
        </section>

        <section>
          <QuestionText id="question-form-office-hours-text">
            Are you joining in-person office hours?
          </QuestionText>
          <Radio.Group
            value={inperson}
            onChange={onLocationChange}
            style={{ marginBottom: 5 }}
          >
            <Radio
              // this is technically not the right way to get the text to get read, but this old version of antd once again does not seem to allow the proper way
              aria-describedby="question-form-office-hours-text"
              value={true}
            >
              Yes
            </Radio>
            <Radio
              aria-describedby="question-form-office-hours-text"
              value={false}
            >
              No
            </Radio>
          </Radio.Group>
        </section>
        {/* <QuestionText>
          Would you like the option of being helped in a group session?
        </QuestionText>
        <Radio.Group
          value={questionGroupable}
          onChange={onGroupableChange}
          style={{ marginBottom: 5 }}
        >
          <Radio value={true}>Yes</Radio>
          <Radio value={false}>No</Radio>
        </Radio.Group>
        <QuestionCaption>
          Clicking Yes may result in a shorter wait time if others have the same
          question as you.
        </QuestionCaption> */}
      </Container>
    </Modal>
  )
}
