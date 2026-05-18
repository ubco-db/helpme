import { Alert, Button, Divider, Form, Input, InputNumber, message, Modal, Tooltip } from 'antd'
import { EmbeddableFeedback, UpdateEmbeddableFeedbackParams } from '@koh/common'
import { CopyOutlined, InfoCircleOutlined } from '@ant-design/icons'
import React, { SetStateAction, useMemo, useState } from 'react'
import { useForm } from 'antd/es/form/Form'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import {
  EmbeddableFeedbackGroup,
} from '@/app/(dashboard)/course/[cid]/(settings)/settings/(embeddable)/components/EmbeddableFeedbackTable'
import FeedbackEntry from '@/app/(dashboard)/course/[cid]/(settings)/settings/(embeddable)/components/FeedbackEntry'

type GradeEmbeddableFeedbackModalProps = {
  courseId: number
  record?: EmbeddableFeedback
  setRecord: React.Dispatch<SetStateAction<EmbeddableFeedback | undefined>>
  onSaveCallback: () => void,
  mode: 'question' | 'assignment',
}

const GradeEmbeddableFeedbackModal: React.FC<GradeEmbeddableFeedbackModalProps> = ({
  courseId,
  record,
  setRecord,
  onSaveCallback,
  mode,
}) => {
  const [form] = useForm<UpdateEmbeddableFeedbackParams>()
  const [loading, setLoading] = useState(false)

  const previousFeedback: { humanGrade: number, humanFeedback?: string } | undefined = useMemo(() => {
    if (record) {
      const temp = record as EmbeddableFeedbackGroup
      const others = temp.answers?.filter(a => a.id !== record.id) ?? []
      others.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      const match = others.find(o => o.humanGrade !== undefined && o.humanGrade !== null)
      if (match) {
        return { humanGrade: match.humanGrade!, humanFeedback: match.humanFeedback }
      }
    }
    return undefined
  }, [record])

  const handleSave = async (values: UpdateEmbeddableFeedbackParams) => {
    if (loading || !record) return
    setLoading(true)

    try {
      if (mode == 'question') {
        await API.lti.embeddableQuestion.updateAnswer(courseId,record.id,values)
      } else {
        await API.lti.embeddableQuestion.assignment.updateAnswer(courseId,record.id,values)
      }
      setRecord(undefined)
      onSaveCallback()
    } catch (err) {
      message.error(`Could not save feedback: ${getErrorMessage(err)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={'Add Feedback & Grade to Submission'}
      open={record != undefined}
      okButtonProps={{ htmlType: 'submit', autoFocus: true, loading }}
      onCancel={() => setRecord(undefined)}
      okText={'Save'}
      destroyOnHidden
      modalRender={(dom) => (
        <Form
          clearOnDestroy
          form={form}
          onFinish={(values) => handleSave(values)}
          initialValues={{
            humanGrade: record?.humanGrade,
            humanFeedback: record?.humanFeedback
          }}
          layout="vertical"
        >
          {dom}
        </Form>
      )}
    >
      <div className={'flex flex-col'}>
        {record && (
          <>
            <div className={'flex flex-col gap-1'}>
              <FeedbackEntry
                feedback={record.aiFeedback}
                grade={record.aiGrade}
                expandableFeedback={true}
                showNAGrade={true}
                gradeSize={'small'}
                showIsAI={true}
              />
            </div>
            <Divider className={'my-2'} />
            {previousFeedback !== undefined && (record.humanGrade === undefined || record.humanGrade === null) && (
              <>
                <Alert
                  type={'info'}
                  message={<span className={'font-bold'}>Existing Feedback Detected</span>}
                  description={
                    <div className={'flex flex-col gap-1'}>
                      <p>A previous submission by the same student received human feedback already.</p>
                      <FeedbackEntry
                        feedback={previousFeedback.humanFeedback}
                        grade={previousFeedback.humanGrade}
                        expandableFeedback={true}
                        showNAGrade={true}
                        gradeSize={'small'}
                      />
                      <div className={'w-full flex justify-end'}>
                        <Button
                          loading={loading}
                          icon={<CopyOutlined/>}
                          onClick={() => handleSave(previousFeedback)}
                        >
                          Use feedback for current submission
                        </Button>
                      </div>
                    </div>
                  }
                />
                <Divider className={'my-2'}/>
              </>
            )}
          </>
        )}
        <Form.Item
          name={'humanGrade'}
          label={
            <div className={'flex w-full'}>
              <Tooltip title="The grade you feel this submission deserves, from 0-100. The grade submitted here is not shown to the student.">
                Grade <InfoCircleOutlined />
              </Tooltip>
            </div>
          }
          required={true}
          rules={[
            {
              type: 'number',
              required: true,
              message: 'Please enter a grade.'
            },
            {
              type: 'number',
              min: 0,
              max: 100,
              message: 'Grade must be between 0 and 100.',
            },
          ]}
        >
          <InputNumber
            placeholder={'0'}
            controls={false}
            min={0}
            max={100}
            parser={(val) => val !== undefined ? parseFloat(val) : NaN}
            suffix={'%'}
          />
        </Form.Item>
        <Form.Item
          name="humanFeedback"
          label={
            <div className={'flex w-full'}>
              <Tooltip title="(Optional) Add feedback for the submission.">
                Feedback <InfoCircleOutlined />
              </Tooltip>
            </div>
          }
          rules={[
            {
              type: 'string',
              whitespace: true,
              message: 'Feedback should contain more than just whitespace characters.',
            },
          ]}
        >
          <Input.TextArea
            rows={3}
            placeholder="(Optional) Enter feedback for submission..."
          />
        </Form.Item>
      </div>
    </Modal>
  )
}

export default GradeEmbeddableFeedbackModal