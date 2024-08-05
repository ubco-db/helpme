import { QuestionCircleOutlined } from '@ant-design/icons'
import { Role, validateQueueConfigInput } from '@koh/common'
import {
  Modal,
  Form,
  Radio,
  Input,
  Switch,
  Tooltip,
  Button,
  message,
} from 'antd'
import TextArea from 'antd/lib/input/TextArea'
import { useState } from 'react'
import { useCourse } from '@/app/hooks/useCourse'
import QueueConfigHelp from './QueueConfigHelp'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'

const exampleLabConfig = {
  fifo_queue_view_enabled: true,
  tag_groups_queue_view_enabled: true,
  default_view: 'fifo',
  minimum_tags: 1,
  tags: {
    tag1: {
      display_name: 'General',
      color_hex: '#66FF66',
    },
    tag2: {
      display_name: 'Bugs',
      color_hex: '#66AA66',
    },
    tag3: {
      display_name: 'Important',
      color_hex: '#FF0000',
    },
  },
  assignment_id: 'lab1',
  tasks: {
    task1: {
      display_name: 'Task 1',
      short_display_name: '1',
      blocking: false,
      color_hex: '#ffedb8',
      precondition: null,
    },
    task2: {
      display_name: 'Task 2',
      short_display_name: '2',
      blocking: false,
      color_hex: '#fadf8e',
      precondition: 'task1',
    },
    task3: {
      display_name: 'Task 3',
      short_display_name: '3',
      blocking: true,
      color_hex: '#f7ce52',
      precondition: 'task2',
    },
    task4: {
      display_name: 'Task 4',
      short_display_name: '4',
      blocking: false,
      color_hex: '#ffce52',
      precondition: 'task3',
    },
  },
}

const exampleConfig = {
  fifo_queue_view_enabled: true,
  tag_groups_queue_view_enabled: true,
  default_view: 'fifo',
  minimum_tags: 0,
  tags: {
    tag1: {
      display_name: 'General',
      color_hex: '#66FF66',
    },
    tag2: {
      display_name: 'Bugs',
      color_hex: '#66AA66',
    },
    tag3: {
      display_name: 'Important',
      color_hex: '#FF0000',
    },
  },
}

type ConfigPresets = 'default' | 'lab'

interface FormValues {
  officeHourName: string
  isOnline: boolean
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

  const onFinish = async (values: FormValues) => {
    setIsLoading(true)
    await API.queues
      .createQueue(
        cid,
        values.officeHourName,
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
        message.error('Error Creating Queue:', errorMessage)
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
      destroyOnClose
      modalRender={(dom) => (
        <Form
          layout="vertical"
          form={form}
          name="form_in_modal"
          initialValues={{
            isOnline: false,
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
        label="Online?"
        name="isOnline"
        layout="horizontal"
        valuePropName="checked"
        tooltip="Online queues have the option for a zoom link"
        rules={[
          { required: true, message: 'Please select if this queue is online.' },
        ]}
      >
        <Switch />
      </Form.Item>

      <Form.Item
        hidden={role === Role.TA}
        label="Configure Queue Permissions"
        name="allowTA"
        layout="horizontal"
        rules={[
          {
            required: true,
            message: 'Please select who can check in.',
          },
        ]}
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
