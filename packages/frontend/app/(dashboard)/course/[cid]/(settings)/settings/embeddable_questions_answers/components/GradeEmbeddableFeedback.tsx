import { Button, Form, InputNumber, Popconfirm, Progress, Tooltip } from 'antd'
import { EmbeddableQuestionFeedback, UpdateEmbeddableFeedbackParams } from '@koh/common'
import { EditOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useForm } from 'antd/es/form/Form'

type GradeEmbeddableFeedbackProps = {
  grade?: number
  record: EmbeddableQuestionFeedback
  handleUpdate: (record: EmbeddableQuestionFeedback, params: UpdateEmbeddableFeedbackParams) => Promise<boolean>
}

const GradeEmbeddableFeedback: React.FC<GradeEmbeddableFeedbackProps> = ({
  grade,
  record,
  handleUpdate,
}) => {
  const [form] = useForm<UpdateEmbeddableFeedbackParams>()
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  async function onSubmit(values: UpdateEmbeddableFeedbackParams) {
    setLoading(true)
    const success = await handleUpdate(record, values)
    if (success) {
      setOpen(false)
    }
    setLoading(false)
  }

  return (
    <Popconfirm
      open={open}
      title="Update Submission Grade"
      description={(
        <div className={'flex flex-col gap-1'}>
          <Form
            clearOnDestroy
            form={form}
            onFinish={(values) => onSubmit(values)}
            initialValues={{ humanGrade: grade }}
            layout="vertical"
          >
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
          </Form>
        </div>
      )}
      okText="Submit"
      okButtonProps={{ htmlType: 'submit', autoFocus: true, loading  }}
      destroyOnHidden
      onCancel={() => setOpen(false)}
    >
      <div className={'flex-1 gap-2 justify-between'}>
        {
          grade
            ? (<Progress size={'small'} type="circle" showInfo percent={grade ? grade : 0}/>)
            : (<span>N/A</span>)
        }
        <Button icon={<EditOutlined />} size="small" onClick={() => setOpen(true)}/>
      </div>
    </Popconfirm>
  )
}

export default GradeEmbeddableFeedback