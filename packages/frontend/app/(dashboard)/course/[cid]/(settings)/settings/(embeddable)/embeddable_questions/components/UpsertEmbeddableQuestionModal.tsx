import { Alert, DatePicker, Form, Input, message, Modal, Tooltip } from 'antd'
import { SetStateAction, useMemo, useState } from 'react'
import { InfoCircleOutlined } from '@ant-design/icons'
import { EmbeddableQuestion, UpsertEmbeddableQuestionParams } from '@koh/common'
import { pick } from 'lodash'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import dayjs from 'dayjs'

type UpsertEmbeddableQuestionModalProps = {
  courseId: number,
  open: boolean,
  setOpen: React.Dispatch<SetStateAction<boolean>>,
  editingQuestion?: EmbeddableQuestion,
  onSaveCallback?: () => void,
  showDateFields?: boolean,
  saveProxy?: (values: UpsertEmbeddableQuestionParams) => void,
}

const UpsertEmbeddableQuestionModal: React.FC<UpsertEmbeddableQuestionModalProps> = ({
  courseId,
  open,
  setOpen,
  editingQuestion,
  onSaveCallback,
  showDateFields = true,
  saveProxy,
}) => {
  const [form] = Form.useForm<UpsertEmbeddableQuestionParams>()
  const [isLoading, setIsLoading] = useState(false)

  const handleSave = async (values: UpsertEmbeddableQuestionParams) => {
    if (isLoading) return
    setIsLoading(true)

    try {
      const sanitized: Record<string,any> = pick(values,['questionText','criteriaText','instructions','name','availableUntil','availableFrom'])
      Object.keys(sanitized).forEach((k) => {
        if (['questionText','criteriaText','instructions','name'].includes(k)) {
          sanitized[k] = sanitized[k]?.trim() ?? undefined
          if (typeof sanitized[k] === 'string' && !sanitized[k]) sanitized[k] = null
        } else {
          if (sanitized[k] === undefined) sanitized[k] = null
          else sanitized[k] = sanitized[k].toDate()
        }
      })
      values = sanitized as any

      if (saveProxy) {
        saveProxy(values)
      } else {
        if (editingQuestion) {
          await API.lti.embeddableQuestion.update(courseId, editingQuestion.id, values)
          message.success('Successfully updated question!')
        } else {
          await API.lti.embeddableQuestion.create(courseId, values)
          message.success('Successfully created question!')
        }
      }

      form.resetFields()
      setOpen(false)
      if (onSaveCallback)
        onSaveCallback()
    } catch (err) {
      message.error(`Could not save question: ${getErrorMessage(err)}`)
    } finally {
      setIsLoading(false)
    }
  }

  const defaults = useMemo(() => {
    if (!editingQuestion) return undefined
    const values = pick(editingQuestion,['name','availableFrom','availableUntil','questionText','criteriaText','instructions'])
    if (values.availableFrom) values.availableFrom = dayjs(new Date(values.availableFrom)) as any
    else delete values.availableFrom
    if (values.availableUntil) values.availableUntil = dayjs(new Date(values.availableUntil)) as any
    else delete values.availableUntil
    return values
  }, [editingQuestion])

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
          initialValues={defaults}
          layout="vertical"
        >
          {dom}
        </Form>
      )}
    >
      <div className={'flex flex-col'}>
        <Form.Item
          name="name"
          label={
            <div className={'flex w-full'}>
              <Tooltip title="(Optional) A custom name/identifier for the question so it can be easily identified in a list.">
                Name <InfoCircleOutlined />
              </Tooltip>
            </div>
          }
        >
          <Input placeholder={'e.g., Assignment 1 Q1'}/>
        </Form.Item>
        {showDateFields && (
          <div className={'grid grid-cols-2 gap-4'}>
            <Form.Item
              name={'availableFrom'}
              label={
                <div className={'flex w-full'}>
                  <Tooltip title="(Optional) When this question will be available for student interaction.">
                    Available From <InfoCircleOutlined />
                  </Tooltip>
                </div>
              }
              getValueProps={(i) => ({ value: i !== undefined ? dayjs(i) : undefined })}
            >
              <DatePicker
                showTime
                allowClear
              />
            </Form.Item>
            <Form.Item
              name={'availableUntil'}
              label={
                <div className={'flex w-full'}>
                  <Tooltip title="(Optional) When this question will stop being available for student interaction.">
                    Available From <InfoCircleOutlined />
                  </Tooltip>
                </div>
              }
              getValueProps={(i) => ({ value: i !== undefined ? dayjs(i) : undefined })}
            >
              <DatePicker
                showTime
                allowClear
              />
            </Form.Item>
          </div>
        )}
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