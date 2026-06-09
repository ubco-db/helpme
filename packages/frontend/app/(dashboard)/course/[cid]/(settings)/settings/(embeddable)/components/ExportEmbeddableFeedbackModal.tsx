import React, { SetStateAction, useMemo, useState } from 'react'
import { Alert, Form, message, Modal, Select, Switch, Tooltip } from 'antd'
import { useForm } from 'antd/es/form/Form'
import {
  EmbeddableAssignment,
  EmbeddableQuestion,
  ExportEmbeddableAssignmentResultsParams,
  ExportEmbeddableQuestionResultsParams,
} from '@koh/common'
import { InfoCircleOutlined } from '@ant-design/icons'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { API } from '@/app/api'

type ExportEmbeddableFeedbackModalProps = {
  courseId: number
  open: boolean
  setOpen: React.Dispatch<SetStateAction<boolean>>
  mode?: 'assignment' | 'question'
  questions?: EmbeddableQuestion[],
  assignments?: EmbeddableAssignment[],
  focusQuestion?: EmbeddableQuestion,
  focusAssignment?: EmbeddableAssignment,
}

const ExportEmbeddableFeedbackModal: React.FC<ExportEmbeddableFeedbackModalProps> = ({
  courseId,
  open,
  setOpen,
  mode,
  questions = [],
  assignments = [],
  focusQuestion,
  focusAssignment,
}) => {
  const [form] = useForm<ExportEmbeddableQuestionResultsParams & { assignmentId: number }>()
  const [loading, setLoading] = useState(false)

  const questionOptions = useMemo(() => questions.map((q) => ({
    label: q.name,
    value: q.id
  })), [questions])

  const assignmentOptions = useMemo(() => assignments.map((a) => ({
    label: a.name,
    value: a.id
  })), [assignments])

  async function onSubmit(values: ExportEmbeddableQuestionResultsParams  & { assignmentId: number }) {
    if (loading) return
    setLoading(true)

    const then0 = async (res: Response) => {
      if (res.headers.get('content-type')?.includes('application/json'))
        throw await res.json()
      return await res.blob()
    }

    const then1 = (blob: Blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `submissions_${mode == 'question' ? `q_${values.questions.join('_')}` : `a_${values.assignmentId}`}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    }

    try {
      if (mode === 'assignment') {
        await API.lti.embeddableQuestion.assignment.exportResults(courseId, values as unknown as ExportEmbeddableAssignmentResultsParams)
          .then(then0)
          .then(then1)
      } else {
        await API.lti.embeddableQuestion.exportResults(courseId, values)
          .then(then0)
          .then(then1)
      }
    } catch (err) {
      message.error(`Failed to export results: ${getErrorMessage(err)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={`Export Embeddable ${mode == 'question' ? 'Question' : 'Assessment'} Results`}
      okButtonProps={{ htmlType: 'submit', autoFocus: true, loading }}
      open={open}
      onCancel={() => setOpen(false)}
      okText={'Export'}
      destroyOnHidden
      modalRender={(dom) => (
        <Form
          clearOnDestroy
          form={form}
          initialValues={{
            assignment: focusAssignment ? [focusAssignment] : undefined,
            questions: focusQuestion ? [focusQuestion] : undefined,
            includeNonSubmitters: false,
            includeAiFeedback: false,
          }}
          onFinish={(values) => onSubmit(values)}
          layout="vertical"
        >
          {dom}
        </Form>
      )}
    >
      {mode == 'assignment' && (
        <Form.Item
          name={'assignmentId'}
          label={
            <div className={'flex w-full'}>
              <Tooltip
                title="The assignment to export results from.">
                Assessment <InfoCircleOutlined />
              </Tooltip>
            </div>
          }
          required={true}
          rules={[
            {
              required: true,
              message: 'Must select an assessment to export data from.',
            },
          ]}
        >
          <Select
            allowClear
            placeholder={'Select assessment results to export'}
            options={assignmentOptions}
          />
        </Form.Item>
      )}
      {mode == 'question' && (
        <Form.Item
          name={'questions'}
          label={
            <div className={'flex w-full'}>
              <Tooltip
                title="The questions to export results from.">
                Questions <InfoCircleOutlined />
              </Tooltip>
            </div>
          }
          required={true}
          rules={[
            {
              required: true,
              message: 'At least one question must be specified to export data for.',
            },
            {
              type: 'array',
              min: 1,
              message: 'Select at least one question to export data for.'
            }
          ]}
        >
          <Select
            mode={'multiple'}
            allowClear
            placeholder={'Select question results to export'}
            options={questionOptions}
          />
        </Form.Item>
      )}
      <Form.Item
        name={'includeNonSubmitters'}
        label={
          <Tooltip
            title="Whether to include results from non-submitters. Submissions will be given a 0 in grade. Do not use this option if your course is large and contains students no longer enrolled in your course.">
            Include Non-Submitters <InfoCircleOutlined />
          </Tooltip>
        }
        required={true}
        rules={[
          {
            required: true,
            message: 'Must select whether non-submitters will be included or not.'
          }
        ]}
      >
        <Switch/>
      </Form.Item>
      <Form.Item
        name={'includeAiFeedback'}
        label={
          <Tooltip
            title="Whether to include the AI grade and feedback provided to the student's submission.">
            Include AI Grade & Feedback <InfoCircleOutlined />
          </Tooltip>
        }
        required={true}
        rules={[
          {
            required: true,
            message: 'Must select whether AI grade/feedback will be included or not.'
          }
        ]}
      >
        <Switch/>
      </Form.Item>
      <Alert
        type={'info'}
        showIcon
        message={<b>Data Export Notice</b>}
        description={
          <div className={'flex flex-col gap-2'}>
            <p>Note that only the latest submission by each student will be included.</p>
          </div>
        }
      />
    </Modal>
  )
}

export default ExportEmbeddableFeedbackModal