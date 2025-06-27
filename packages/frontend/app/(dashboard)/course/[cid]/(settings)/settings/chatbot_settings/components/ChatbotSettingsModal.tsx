'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Button,
  message,
  Select,
  Tooltip,
  Space,
  Progress,
  ProgressProps,
} from 'antd'
import {
  InfoCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { ChatbotSettingsMetadata } from '@koh/common'

interface ChatbotSettingsModalProps {
  open: boolean
  courseId: number
  onClose: () => void
}

enum AvailableModelTypes {
  Qwen = 'qwen2.5:7b',
  DEEPSEEK = 'deepseek-r1:14b',
  GPT4o_mini = 'gpt-4o-mini',
  GPT4o = 'gpt-4o',
}

const ChatbotSettingsModal: React.FC<ChatbotSettingsModalProps> = ({
  open,
  courseId,
  onClose,
}) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [availableModels, setAvailableModels] = useState<string[] | null>(null)

  const fetchChatbotSettings = useCallback(async () => {
    setLoading(true)
    await API.chatbot.staffOnly
      .getSettings(courseId)
      .then((currentChatbotSettings) => {
        setAvailableModels(
          Object.values(currentChatbotSettings.AvailableModelTypes),
        )
        form.setFieldsValue({
          ...currentChatbotSettings.metadata,
        })
      })
      .catch((error) => {
        message.error(
          'Failed to load chatbot settings: ' + getErrorMessage(error),
        )
      })
      .finally(() => {
        setLoading(false)
      })
  }, [courseId, form])

  useEffect(() => {
    if (open && courseId) {
      fetchChatbotSettings()
    }
  }, [open, courseId, fetchChatbotSettings])

  const handleUpdate = async (values: ChatbotSettingsMetadata) => {
    const updateData = {
      modelName: values.modelName,
      prompt: values.prompt,
      similarityThresholdDocuments: values.similarityThresholdDocuments,
      temperature: values.temperature,
      topK: values.topK,
    }

    setLoading(true)
    await API.chatbot.staffOnly
      .updateSettings(courseId, updateData)
      .then(() => {
        message.success('Settings updated successfully')
        onClose()
      })
      .catch((err) => {
        message.error('Failed to update settings' + getErrorMessage(err))
      })
      .finally(() => {
        setLoading(false)
      })
  }

  const handleReset = () => {
    Modal.confirm({
      title: 'Are you sure reset the chatbot settings?',
      icon: <ExclamationCircleOutlined />,
      content:
        'This will revert all settings to their default values and cannot be undone.',
      onOk: async () => {
        setLoading(true)
        await API.chatbot.staffOnly
          .resetSettings(courseId)
          .then(() => {
            message.success('Settings have been reset successfully')
            fetchChatbotSettings() // Reload settings to update UI
          })
          .catch((err) => {
            message.error('Failed to reset settings' + getErrorMessage(err))
          })
          .finally(() => {
            setLoading(false)
          })
      },
    })
  }

  // Build the options only from availableModels provided by chatbot server
  const selectOptions = !availableModels
    ? []
    : availableModels.map((model) => {
        switch (model) {
          case AvailableModelTypes.GPT4o_mini:
            return {
              label: (
                <span>
                  <Tooltip
                    title={
                      <ModelTooltipInfo
                        speed={100}
                        quality={65}
                        additionalNotes={['Runs on OpenAI servers']}
                      />
                    }
                  >
                    {' '}
                    <InfoCircleOutlined />{' '}
                  </Tooltip>
                  ChatGPT-4o Mini
                </span>
              ),
              value: model,
            }
          case AvailableModelTypes.GPT4o:
            return {
              label: (
                <span>
                  <Tooltip
                    title={
                      <ModelTooltipInfo
                        speed={90}
                        quality={75}
                        additionalNotes={['Runs on OpenAI servers']}
                      />
                    }
                  >
                    {' '}
                    <InfoCircleOutlined />{' '}
                  </Tooltip>
                  ChatGPT-4o
                </span>
              ),
              value: model,
            }
          case AvailableModelTypes.DEEPSEEK:
            return {
              label: (
                <span>
                  <Tooltip
                    title={
                      <ModelTooltipInfo
                        speed={60}
                        quality={100}
                        additionalNotes={[
                          'Runs on UBC servers - Safe for student data',
                          'Reasoning model - Will "think" before responding',
                        ]}
                      />
                    }
                  >
                    {' '}
                    <InfoCircleOutlined />{' '}
                  </Tooltip>
                  Deepseek R1{' '}
                  <span className="text-gray-400"> (Recommended)</span>
                </span>
              ),
              value: model,
            }
          case AvailableModelTypes.Qwen:
            return {
              label: (
                <span>
                  <Tooltip
                    title={
                      <ModelTooltipInfo
                        speed={75}
                        quality={85}
                        additionalNotes={[
                          'Runs on UBC servers - Safe for student data',
                        ]}
                      />
                    }
                  >
                    {' '}
                    <InfoCircleOutlined />{' '}
                  </Tooltip>
                  Qwen 2.5{' '}
                  <span className="ml-5 text-gray-400"> (Recommended)</span>
                </span>
              ),
              value: model,
            }
          default:
            return {
              label: model,
              value: model,
            }
        }
      })

  return (
    <Modal
      title="Chatbot Settings"
      open={open}
      onCancel={onClose}
      footer={null}
    >
      <Form form={form} layout="vertical" onFinish={handleUpdate}>
        <Form.Item
          name="modelName"
          label={
            <Tooltip title="Select the base large language model you want to use for the chatbot.">
              Model <InfoCircleOutlined />
            </Tooltip>
          }
          rules={[{ required: true, message: 'Please select a model' }]}
        >
          <Select
            options={selectOptions}
            loading={availableModels === null}
          ></Select>
        </Form.Item>

        <Form.Item
          name="prompt"
          label={
            <Tooltip title="Input the default prompt that the model will use to initiate conversations.">
              Prompt <InfoCircleOutlined />
            </Tooltip>
          }
          rules={[{ required: true, message: 'Please input the prompt' }]}
        >
          <Input.TextArea rows={6} />
        </Form.Item>

        <Form.Item
          name="temperature"
          label={
            <Tooltip title="Adjust the temperature to control the randomness of the generation. Lower values make responses more predictable. Only applies for some models.">
              Temperature <InfoCircleOutlined />
            </Tooltip>
          }
          rules={[{ required: true, message: 'Please input the temperature!' }]}
        >
          <InputNumber min={0} max={1} step={0.1} />
        </Form.Item>

        <Form.Item
          name="topK"
          label={
            <Tooltip title="This number influences the max number of text chunks the chatbot would retrieve and cite per question. Consider turning this up if the questions for your course generally require more chunks of context to answer properly.">
              Top K Chunks <InfoCircleOutlined />
            </Tooltip>
          }
          rules={[{ required: true, message: 'Please input the top K!' }]}
        >
          <InputNumber />
        </Form.Item>

        <Form.Item
          name="similarityThresholdDocuments"
          label={
            <Tooltip title="Set the minimum similarity threshold when retrieving relevant information blocks. Turn this up if you notice that the chatbot is grabbing irrelevant documents.">
              Similarity Threshold for Chunks <InfoCircleOutlined />
            </Tooltip>
          }
          rules={[
            {
              required: true,
              message: 'Please input the similarity threshold documents!',
            },
          ]}
        >
          <InputNumber min={0} max={1} step={0.1} />
        </Form.Item>

        <Space className="flex justify-end">
          <Button onClick={handleReset} loading={loading}>
            Reset to default settings
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            Update settings
          </Button>
        </Space>
      </Form>
    </Modal>
  )
}

export default ChatbotSettingsModal

const scaleColors: ProgressProps['strokeColor'] = {
  '0%': '#108ee9',
  '100%': '#87d068',
}
const trailColor = '#cfcfcf'

const ModelTooltipInfo: React.FC<{
  speed: number
  quality: number
  additionalNotes?: string[]
}> = ({ speed, quality, additionalNotes }) => {
  return (
    <div>
      <div className="mr-2 flex w-full items-center justify-between gap-x-2">
        <div>Response Quality</div>
        <Progress
          percent={quality}
          size="small"
          steps={20}
          strokeColor={scaleColors}
          trailColor={trailColor}
          showInfo={false}
        />
      </div>
      <div className="mr-2 flex w-full items-center justify-between gap-x-2">
        <div>Speed</div>
        <Progress
          percent={speed}
          size="small"
          steps={20}
          strokeColor={scaleColors}
          trailColor={trailColor}
          showInfo={false}
        />
      </div>
      {additionalNotes && (
        <ul className="list-disc pl-4 leading-tight text-gray-100">
          {additionalNotes.map((note, index) => (
            <li key={index}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
