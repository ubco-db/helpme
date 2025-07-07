import { QuestionCircleOutlined } from '@ant-design/icons'
import { QueueTypes, Role, validateQueueConfigInput } from '@koh/common'
import {
  Modal,
  Form,
  Radio,
  Input,
  Switch,
  Tooltip,
  Button,
  message,
  Segmented,
} from 'antd'
import TextArea from 'antd/lib/input/TextArea'
import { useState } from 'react'
import { useCourse } from '@/app/hooks/useCourse'
import QueueConfigHelp from './QueueConfigHelp'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import exampleConfig from '@/public/exampleQueueConfig.json'
import exampleLabConfig from '@/public/exampleQueueLabConfig.json'

type ConfigPresets = 'default' | 'lab'

interface FormValues {
  officeHourName: string
  type: QueueTypes
  allowTA: boolean
  notes: string
  queue_config: string
}

interface CreateQueueModalProps {
  cid: number
  open: boolean
  onSuccessfulSubmit: () => void
  onCancel: () => void
  role: Role
}

const CreateQueueModal: React.FC<CreateQueueModalProps> = ({
  cid,
  open,
  onSuccessfulSubmit,
  onCancel,
  role,
}) => {
  const [form] = Form.useForm()
  const { mutateCourse } = useCourse(cid)
  const [isLoading, setIsLoading] = useState(false)
  const [hoveredConfig, setHoveredConfig] = useState<ConfigPresets>('default')

  const queueTypeOptions = [
    { label: 'Online', value: 'online' },
    { label: 'Hybrid', value: 'hybrid' },
    { label: 'In-Person', value: 'inPerson' },
  ]

  const onFinish = async (values: FormValues) => {
    setIsLoading(true)
    await API.queues
      .createQueue(
        cid,
        values.officeHourName,
        values.type,
        !values.allowTA,
        values.notes ?? '',
        values.queue_config ? JSON.parse(values.queue_config) : {},
      )
      .then(() => {
        mutateCourse()
        message.success(`Created a new queue ${values.officeHourName}`)
        onSuccessfulSubmit()
      })
      .catch((e) => {
        const errorMessage = getErrorMessage(e)
        message.error('Error Creating Queue:' + errorMessage)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  const confirmLoadConfig = (preset: ConfigPresets) => {
    const configValue = form.getFieldValue('queue_config')
    const configToLoad = preset === 'lab' ? exampleLabConfig : exampleConfig

    if (configValue) {
      Modal.confirm({
        title: `Are you sure you want to load the example ${preset === 'lab' ? 'lab ' : ''}config?`,
        content: 'This will overwrite your current config.',
        onOk() {
          form.setFieldsValue({
            queue_config: JSON.stringify(configToLoad, null, 2),
          })
        },
      })
    } else {
      form.setFieldsValue({
        queue_config: JSON.stringify(configToLoad, null, 2),
      })
    }
  }

  return (
    <Modal
      open={open}
      title="Create a new queue"
      okText="Create"
      cancelText="Cancel"
      okButtonProps={{
        autoFocus: true,
        htmlType: 'submit',
        loading: isLoading,
      }}
      width={800}
      onCancel={onCancel}
      destroyOnHidden
      modalRender={(dom) => (
        <Form
          layout="vertical"
          form={form}
          name="form_in_modal"
          initialValues={{
            type: 'hybrid',
            allowTA: true,
          }}
          clearOnDestroy
          onFinish={(values) => onFinish(values)}
        >
          {dom}
        </Form>
      )}
    >
      <Form.Item
        label="Queue Location"
        name="type"
        layout="horizontal"
        tooltip="Online and Hybrid queues have an option for a zoom link, and students will be prompted to join this zoom link once you start helping them."
      >
        <Segmented options={queueTypeOptions} />
      </Form.Item>

      <Form.Item
        hidden={role === Role.TA}
        label="Configure Queue Permissions"
        name="allowTA"
        layout="horizontal"
      >
        <Radio.Group>
          <Radio value={true}>Allow TAs to check in</Radio>
          <Radio value={false}>Allow professors only</Radio>
        </Radio.Group>
      </Form.Item>

      <Form.Item
        label="Queue Name"
        name="officeHourName"
        layout="horizontal"
        rules={[
          {
            required: true,
            message: 'Please give this room a name.',
          },
        ]}
      >
        <Input
          placeholder={
            'Ex: Lab name, lab section, physical room location, or a mix'
          }
        />
      </Form.Item>

      <Form.Item label="Additional Notes" name="notes">
        <TextArea
          rows={4}
          placeholder="Ex. Lab name, lab section, physical room location, any announcements, links to external resources, a mix of these, or any other details"
        />
      </Form.Item>

      <Form.Item
        label={
          <span>
            <span>
              <span className="mr-1">Queue Config</span>
              <Tooltip
                title={
                  'Here you can specify a JSON config to automatically set up question tags, tasks, and other settings for the queue. For example, you can use this to set up a chemistry lab that requires certain tasks to be checked off (e.g. have the TA look at the experiment before continuing). You can also easily externally save this config and copy/paste this config to other queues and courses.'
                }
              >
                <QuestionCircleOutlined style={{ color: 'gray' }} />
              </Tooltip>
            </span>
            <Button
              size="small"
              className="ml-2"
              onClick={() => confirmLoadConfig('default')}
              onMouseEnter={() => setHoveredConfig('default')}
            >
              Load Example Config
            </Button>
            <Button
              size="small"
              className="ml-2"
              onClick={() => confirmLoadConfig('lab')}
              onMouseEnter={() => setHoveredConfig('lab')}
            >
              Load Example Lab Config
            </Button>
          </span>
        }
        labelCol={{ span: 24 }}
        name="queue_config"
        rules={[
          {
            validator: (_, value) => {
              if (value) {
                try {
                  const parsedConfig = JSON.parse(value)
                  const configError = validateQueueConfigInput(parsedConfig)
                  if (configError) {
                    return Promise.reject(new Error(configError))
                  }
                } catch (error) {
                  return Promise.reject(
                    new Error('Invalid JSON: ' + (error as Error).message),
                  )
                }
              }
              return Promise.resolve()
            },
          },
        ]}
      >
        <TextArea
          className="!h-[30rem] w-full"
          spellCheck="false"
          allowClear
          placeholder={JSON.stringify(
            hoveredConfig === 'lab' ? exampleLabConfig : exampleConfig,
            null,
            2,
          )}
        />
      </Form.Item>
      <QueueConfigHelp />
    </Modal>
  )
}

export default CreateQueueModal
