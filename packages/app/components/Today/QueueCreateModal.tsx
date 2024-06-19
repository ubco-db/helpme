import { QuestionCircleOutlined } from '@ant-design/icons'
import { Role, validateQueueConfigInput } from '@koh/common'
import {
  Modal,
  Form,
  Radio,
  Input,
  Switch,
  Tooltip,
  Collapse,
  List,
  Button,
} from 'antd'
import { FormInstance } from 'antd/lib/form'
import TextArea from 'antd/lib/input/TextArea'
import { ReactElement } from 'react'
import { useState } from 'react'
import QueueConfigHelp from '../Questions/Shared/QueueConfigHelp'

interface QueueCreateModalProps {
  visible: boolean
  onSubmit: (form: FormInstance) => void
  onCancel: () => void
  role: Role
  lastName: string
}

export default function QueueCreateModal({
  visible,
  onSubmit,
  onCancel,
  role,
  lastName,
}: QueueCreateModalProps): ReactElement {
  const [form] = Form.useForm()
  const [locEditable, setLocEditable] = useState(
    !form.getFieldValue('isOnline'),
  )

  const onIsOnlineUpdate = (isOnline) => {
    setLocEditable(!isOnline)
    if (!isOnline) {
      form.setFieldsValue({
        officeHourName: '',
      })
    } else {
      updateRoomName()
    }
  }

  const updateRoomName = () => {
    const online = form.getFieldValue('isOnline')
    const allowTA = form.getFieldValue('allowTA')
    if (online) {
      form.setFieldsValue({
        officeHourName: allowTA
          ? `Online`
          : `Online - Professor ${lastName}'s Office Hours`,
      })
    }
  }

  const handleSubmit = () => {
    const configValue = form.getFieldValue('config')

    // If config is empty, set it to an empty object
    if (!configValue) {
      form.setFieldsValue({ config: '{}' })
    }

    onSubmit(form)
  }

  const exampleConfig = {
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
    },
  }

  return (
    <Modal
      title={`Create a new queue`}
      visible={visible}
      onCancel={onCancel}
      okText="Create"
      onOk={handleSubmit}
      width={800}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label={<strong>Online?</strong>}
          name="isOnline"
          initialValue={false}
          valuePropName="checked"
          tooltip="Online queues have the option for a zoom link"
        >
          <Switch onChange={onIsOnlineUpdate} />
        </Form.Item>

        <Form.Item
          hidden={role === Role.TA}
          label={<strong>Configure Queue Permissions</strong>}
          name="allowTA"
          initialValue={true}
        >
          <Radio.Group onChange={updateRoomName}>
            <Radio value={false}>Allow professors only</Radio>
            <Radio value={true}>Allow TAs to check in</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          label={<strong>Queue Name</strong>}
          name="officeHourName"
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
            disabled={!locEditable}
            style={{ width: 390 }}
          />
        </Form.Item>

        <Form.Item
          label={<strong>Additional Notes (optional)</strong>}
          name="notes"
          style={{ width: '100%' }}
        >
          <TextArea
            rows={4}
            placeholder="Ex. Lab name, lab section, physical room location, any announcements, a mix of these, or any other details"
          />
        </Form.Item>

        <Form.Item
          label={
            <span>
              <span>
                <strong>Queue Config</strong>&nbsp;
                <Tooltip
                  title={
                    'Here you can specify a JSON config to automatically set up question tags, tasks, and other settings for the queue. For example, you can use this to set up a chemistry lab that requires certain tasks to be checked off (e.g. have the TA look at the experiment before continuing). It is recommended to create a new queue for each lab assignment. You can also easily externally save this config and copy/paste this config to other queues and courses.'
                  }
                >
                  <QuestionCircleOutlined style={{ color: 'gray' }} />
                </Tooltip>
              </span>
              <Button
                size="small"
                className="ml-2"
                onClick={() => {
                  const configValue = form.getFieldValue('config')
                  if (configValue) {
                    Modal.confirm({
                      title:
                        'Are you sure you want to load the example config?',
                      content: 'This will overwrite your current config.',
                      onOk() {
                        form.setFieldsValue({
                          config: JSON.stringify(exampleConfig, null, 2),
                        })
                      },
                    })
                  } else {
                    form.setFieldsValue({
                      config: JSON.stringify(exampleConfig, null, 2),
                    })
                  }
                }}
              >
                Load Example Config
              </Button>
            </span>
          }
          labelCol={{ span: 24 }}
          name="config"
          style={{ width: '100%' }}
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
                      new Error('Invalid JSON: ' + error.message),
                    )
                  }
                }
                return Promise.resolve()
              },
            },
          ]}
        >
          <TextArea
            className="!h-96 w-full"
            spellCheck="false"
            placeholder={JSON.stringify(exampleConfig, null, 2)}
          />
        </Form.Item>
        <QueueConfigHelp />
      </Form>
    </Modal>
  )
}
