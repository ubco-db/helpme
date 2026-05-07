import { Modal, Input, Tooltip, Form, Alert, message } from 'antd'
import { SetStateAction, useEffect, useState } from 'react'
import { InfoCircleOutlined } from '@ant-design/icons'
import { IFrameQuestion } from '@koh/common'
import { pick } from 'lodash'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'

type UpsertIFrameQuestionModalProps = {
  courseId: number,
  open: boolean,
  setOpen: React.Dispatch<SetStateAction<boolean>>,
  editingQuestion?: IFrameQuestion,
  onSaveCallback: () => void,
}

type IFrameQuestionForm = {
  questionText?: string,
  criteriaText?: string,
  instructions?: string,
}

const UpsertIFrameQuestionModal: React.FC<UpsertIFrameQuestionModalProps> = ({
  courseId,
  open,
  setOpen,
  editingQuestion,
  onSaveCallback,
}) => {
  const [form] = Form.useForm<IFrameQuestionForm>()
  const [formValues, setFormValues] = useState<IFrameQuestionForm>({})

  useEffect(() => {
    if (editingQuestion) {
      const values = pick(editingQuestion,['questionText','criteriaText','instructions'])
      form.setFieldsValue(values)
      setFormValues(values)
    } else {
      form.resetFields(['questionText','criteriaText','instructions'])
      setFormValues({})
    }
  }, [editingQuestion, form])

  const handleSave = async () => {
    form
      .validateFields()
      .then(async (values) => {
        Object.keys(values).forEach((k) => {
          (values as any)[k] = (values as any)[k]?.trim() ?? undefined
          if (typeof (values as any)[k] === 'string' && !(values as any)[k]) (values as any)[k] = null
        })
        if (editingQuestion) {
          await API.lti.iframeQuestion.update(courseId, editingQuestion.id, {
            ...values,
          } as any)
          message.success('Successfully updated question!')
        } else {
          await API.lti.iframeQuestion.create(courseId, {
            ...values,
          } as any)
          message.success('Successfully created question!')
        }
        setOpen(false)
        form.resetFields(['questionText','criteriaText','instructions'])
        setFormValues({})
        onSaveCallback()
      })
      .catch((err) => {
        message.error(`Failed to save question: ${getErrorMessage(err)}`)
      })
  }

  return (
    <Modal
      title={editingQuestion ? 'Edit Question' : 'Create Question'}
      open={open}
      onOk={handleSave}
      onCancel={() => setOpen(false)}
      okText={editingQuestion ? 'Save' : 'Create'}
    >
      <Form
        form={form}
        initialValues={editingQuestion ? pick(editingQuestion,['questionText','criteriaText','instructions']) : undefined}
        layout="vertical"
        onValuesChange={(changedValues, values) => {
          setFormValues({
            ...values,
            ...changedValues,
          })
        }}
      >
        <div className={'flex flex-col'}>
          <Form.Item
            name="questionText"
            label={
              <div className={'flex w-full'}>
                <Tooltip title="The question that students should submit an answer to.">
                  Question <InfoCircleOutlined />
                </Tooltip>
              </div>
            }
            required={true}
            shouldUpdate={(prevValue, newValue) => prevValue !== newValue}
          >
            <div className="flex flex-col">
              <Input.TextArea
                value={formValues['questionText'] as any}
                rows={3}
                placeholder="e.g. Reflect on how the themes in this week's reading relate to your own experience."
              />
            </div>
          </Form.Item>
          <Alert
            className={'my-2'}
            type={'warning'}
            showIcon
            message={
              <span className={'font-semibold'}>
                Note on AI Prompting
              </span>
            }
            description={`Unlike the course chatbot, the prompt used to instruct the AI when generating feedback uses only the Question Text, Criteria and Instructions (if any) you enter here. Nothing else is included. The course prompt, HelpMe system prompt, and chatbot knowledge base are not used when generating feedback.`}
          />
          <Form.Item
            name="criteriaText"
            label={
              <div className={'flex flex-col w-full'}>
                <Tooltip title="The criteria that will be used to generate constructive feedback for the student's submission.">
                  Criteria <InfoCircleOutlined />
                </Tooltip>
              </div>
            }
            required={true}
            shouldUpdate={(prevValue, newValue) => prevValue !== newValue}
          >
            <div className="flex flex-col">
              <Input.TextArea
                value={formValues['criteriaText'] as any}
                rows={3}
                placeholder="e.g. The response should reference at least two specific themes and provide personal examples."
              />
            </div>
          </Form.Item>
          <Form.Item
            name="instructions"
            label={
              <div className={'flex w-full'}>
                <Tooltip title="(Optional) Additional instructions that should be used in grading that are not directly criteria.">
                  Additional Instructions <InfoCircleOutlined />
                </Tooltip>
              </div>
            }
            shouldUpdate={(prevValue, newValue) => prevValue !== newValue}
          >
            <div className="flex flex-col">
              <Input.TextArea
                value={formValues['instructions'] as any}
                rows={3}
                placeholder="e.g. Feedback should include a 1-5 rating for structure, grammatical correctness, and thoughtfulness."
              />
            </div>
          </Form.Item>
        </div>
      </Form>
    </Modal>
  )
}

export default UpsertIFrameQuestionModal;