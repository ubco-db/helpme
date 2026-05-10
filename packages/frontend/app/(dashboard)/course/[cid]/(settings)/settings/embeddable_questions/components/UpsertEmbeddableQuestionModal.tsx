import { Modal, Input, Tooltip, Form, Alert, message } from 'antd'
import { SetStateAction, useEffect, useState } from 'react'
import { InfoCircleOutlined } from '@ant-design/icons'
import { EmbeddableQuestion } from '@koh/common'
import { pick } from 'lodash'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import {
  EmbeddableQuestionFeedbackProps
} from '@/app/lti/embeddable-question/[cid]/[qid]/components/EmbeddableQuestionFeedback'

type UpsertEmbeddableQuestionModalProps = {
  courseId: number,
  open: boolean,
  setOpen: React.Dispatch<SetStateAction<boolean>>,
  editingQuestion?: EmbeddableQuestion,
  onSaveCallback: () => void,
}

type EmbeddableQuestionForm = {
  questionText?: string,
  criteriaText?: string,
  instructions?: string,
}

const UpsertEmbeddableQuestionModal: React.FC<UpsertEmbeddableQuestionModalProps> = ({
  courseId,
  open,
  setOpen,
  editingQuestion,
  onSaveCallback,
}) => {
  const [form] = Form.useForm<EmbeddableQuestionForm>()
  const [isLoading, setIsLoading] = useState(false)

  const handleSave = async (values: EmbeddableQuestionForm) => {
    if (isLoading) return
    setIsLoading(true)

    try {
      Object.keys(values).forEach((k) => {
        (values as any)[k] = (values as any)[k]?.trim() ?? undefined
        if (typeof (values as any)[k] === 'string' && !(values as any)[k]) (values as any)[k] = null
      })
      if (editingQuestion) {
        await API.lti.embeddableQuestion.update(courseId, editingQuestion.id, {
          ...values,
        } as any)
        message.success('Successfully updated question!')
      } else {
        await API.lti.embeddableQuestion.create(courseId, {
          ...values,
        } as any)
        message.success('Successfully created question!')
      }
      setOpen(false)
      onSaveCallback()
    } catch (err) {
      message.error(`Could not save question: ${getErrorMessage(err)}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal
      title={editingQuestion ? 'Edit Question' : 'Create Question'}
      open={open}
      okButtonProps={{ htmlType: 'submit', autoFocus: true, loading: isLoading }}
      onCancel={() => setOpen(false)}
      okText={editingQuestion ? 'Save' : 'Create'}
      destroyOnHidden
      modalRender={(dom) => (
        <Form
          clearOnDestroy
          form={form}
          onFinish={(values) => handleSave(values)}
          initialValues={editingQuestion ? pick(editingQuestion,['questionText','criteriaText','instructions']) : undefined}
          layout="vertical"
        >
          {dom}
        </Form>
      )}
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
          rules={[
            {
              type: 'string',
              required: true,
              message: 'Question is required.',
            },
            {
              type: 'string',
              whitespace: true,
              message: 'Question should contain more than just whitespace characters.',
            },
          ]}
        >
          <Input.TextArea
            rows={3}
            placeholder="e.g. Reflect on how the themes in this week's reading relate to your own experience."
          />
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
          description={`Unlike the course chatbot, the prompt used to instruct the AI when generating feedback uses only the Submission and the Question Text, Criteria, and any additional Instructions you enter here. The Course Prompt and Chatbot Knowledge Base are not used when generating feedback (but this may be a separate feature in the future).`}
        />
        <Form.Item
          name="criteriaText"
          label={
            <div className={'flex flex-col w-full'}>
              <Tooltip
                title="The criteria that will be used to generate constructive feedback for the student's submission.">
                Criteria <InfoCircleOutlined />
              </Tooltip>
            </div>
          }
          required={true}
          rules={[
            {
              type: 'string',
              required: true,
              message: 'Criteria are required.',
            },
            {
              type: 'string',
              whitespace: true,
              message: 'Criteria should contain more than just whitespace characters.',
            },
          ]}
        >
          <Input.TextArea
            rows={3}
            placeholder="e.g. The response should reference at least two specific themes and provide personal examples."
          />
        </Form.Item>
        <Form.Item
          name="instructions"
          label={
            <div className={'flex w-full'}>
              <Tooltip
                title="(Optional) Additional instructions that should be used in grading that are not directly criteria.">
                Additional Instructions <InfoCircleOutlined />
              </Tooltip>
            </div>
          }
        >
          <Input.TextArea
            rows={3}
            placeholder="e.g. Feedback should include a 1-5 rating for structure, grammatical correctness, and thoughtfulness."
          />
        </Form.Item>
      </div>
    </Modal>
  )
}

export default UpsertEmbeddableQuestionModal;