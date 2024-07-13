import { ReactElement, useState } from 'react'
import Modal from 'antd/lib/modal/Modal'
import { Input, Form, message, Select } from 'antd'
import styled from 'styled-components'
import { API } from '@koh/api-client'
import PropTypes from 'prop-types'
import { default as React } from 'react'
import { useRouter } from 'next/router'
import { QuestionTypeParams, AsyncQuestion } from '@koh/common'
import { QuestionType } from '../Shared/QuestionType'
import { useQuestionTypes } from '../../../hooks/useQuestionTypes'

const Container = styled.div`
  max-width: 960px;
`

const QuestionText = styled.div`
  font-weight: normal;
  font-size: 14px;
  line-height: 22px;
  margin-bottom: 4px;
`

interface EditQueueModalProps {
  question: AsyncQuestion
  visible: boolean
  onClose: () => void
  onStatusChange: () => void
}

UpdateQuestionForm.propTypes = {
  value: PropTypes.any.isRequired,
  onClose: PropTypes.func.isRequired,
}

export function UpdateQuestionForm({
  question,
  visible,
  onClose,
  onStatusChange,
}: EditQueueModalProps): ReactElement {
  const router = useRouter()
  const courseId = Number(router.query['cid'])
  const [form] = Form.useForm()
  const [questionTypes] = useQuestionTypes(courseId, null)
  const [questionTypeInput, setQuestionTypeInput] = useState<
    QuestionTypeParams[]
  >(question?.questionTypes || [])

  //update question, no new text generated

  const updateQuestion = async (value) => {
    await API.asyncQuestions.update(question.id, {
      questionTypes: questionTypeInput,
      questionText: value.questionText,
      questionAbstract: value.QuestionAbstract,
    })
    message.success('Question Updated')
    onStatusChange()
  }

  const onFinish = (value) => {
    updateQuestion(value)
  }

  const onTypeChange = (selectedIds: number[]) => {
    const newQuestionTypeInput: QuestionTypeParams[] = questionTypes?.filter(
      (questionType) => selectedIds.includes(questionType.id),
    )
    setQuestionTypeInput(newQuestionTypeInput)
  }

  return (
    <Modal
      title="Question Form"
      open={visible}
      onCancel={onClose}
      onOk={async () => {
        const value = await form.validateFields()
        onFinish(value)
        onClose()
      }}
    >
      <Container>
        <Form
          form={form}
          initialValues={{
            QuestionAbstract: question?.questionAbstract,
            questionText: question?.questionText,
          }}
        >
          <QuestionText>What do you need help with?</QuestionText>
          <Form.Item name="QuestionAbstract" rules={[{ required: true }]}>
            <Input placeholder="Question abstract" maxLength={50}></Input>
          </Form.Item>
          <Form.Item name="questionText" rules={[{ required: true }]}>
            <Input.TextArea
              allowClear={true}
              placeholder="Question details "
              autoSize={{ minRows: 3, maxRows: 6 }}
            />
          </Form.Item>
          {questionTypes?.length > 0 ? (
            <>
              <QuestionText>
                What category(s) does your question fall under?
              </QuestionText>
              <Select
                mode="multiple"
                placeholder="Select question tags"
                onChange={onTypeChange}
                style={{ width: '100%' }}
                value={questionTypeInput.map((type) => type.id)}
                tagRender={(props) => {
                  const type = questionTypes?.find(
                    (type) => type.id === props.value,
                  )
                  return (
                    <QuestionType
                      typeName={type.name}
                      typeColor={type.color}
                      onClick={props.onClose}
                    />
                  )
                }}
              >
                {questionTypes?.map((type) => (
                  <Select.Option value={type.id} key={type.id}>
                    {type.name}
                  </Select.Option>
                ))}
              </Select>
            </>
          ) : (
            <p>No Question tags found</p>
          )}

          <br></br>
          <br></br>
          <QuestionText>Your question will be anonymous.</QuestionText>
          <QuestionText>
            Other students will not see your name or profile image.
          </QuestionText>
        </Form>
      </Container>
    </Modal>
  )
}
