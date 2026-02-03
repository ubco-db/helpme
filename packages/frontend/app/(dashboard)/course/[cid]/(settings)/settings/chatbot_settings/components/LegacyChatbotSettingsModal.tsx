'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Button,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Progress,
  ProgressProps,
  Select,
  Space,
  Tooltip,
} from 'antd'
import {
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { API } from '@/app/api'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { ChatbotCourseSettingsProperties } from '@koh/common'
import ChatbotHelpTooltip from '../../components/ChatbotHelpTooltip'

interface LegacyChatbotSettingsModalProps {
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

const LegacyChatbotSettingsModal: React.FC<LegacyChatbotSettingsModalProps> = ({
  open,
  courseId,
  onClose,
}) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [loadingModels, setLoadingModels] = useState(false)
  const [availableModels, setAvailableModels] = useState<Record<
    string,
    string
  > | null>(null)

  const fetchAvailableModels = useCallback(async () => {
    setLoadingModels(true)
    API.chatbot.staffOnly.legacy
      .getModels(courseId)
      .then((availableModels) => {
        setAvailableModels(availableModels)
      })
      .catch((error) => {
        message.error(
          'Failed to load available models: ' + getErrorMessage(error),
        )
      })
      .finally(() => setLoadingModels(false))
  }, [courseId])

  const fetchChatbotSettings = useCallback(async () => {
    setLoading(true)
    await API.chatbot.staffOnly.legacy
      .getSettings(courseId)
      .then((currentChatbotSettings) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { courseId, model, organizationSettings, ...rest } =
          currentChatbotSettings
        form.setFieldsValue({
          rest,
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
      fetchAvailableModels().then()
      fetchChatbotSettings().then()
    }
  }, [open, courseId, fetchChatbotSettings, fetchAvailableModels])

  const handleUpdate = async (values: ChatbotCourseSettingsProperties) => {
    const updateData = {
      modelName: values.modelName,
      prompt: values.prompt,
      similarityThresholdDocuments: values.similarityThresholdDocuments,
      temperature: values.temperature,
      topK: values.topK,
    }

    setLoading(true)
    await API.chatbot.staffOnly.legacy
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
        await API.chatbot.staffOnly.legacy
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
    : Object.keys(availableModels).map((modelKey) => {
        const model = availableModels[modelKey]
        switch (model) {
          case AvailableModelTypes.GPT4o_mini:
            return {
              label: (
                <span>
                  <Tooltip
                    title={
                      <ModelTooltipInfo
                        speed={80}
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
                        speed={70}
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
                        speed={100}
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
      centered
      title={
        <div className="flex items-center gap-2">
          <SettingOutlined />
          <div className="w-full md:flex">
            <p>Chatbot Settings</p>
            <ChatbotHelpTooltip
              forPage="chatbot_settings_modal"
              className="mr-6 inline-block md:ml-auto md:block"
            />
          </div>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
    >
      <Form form={form} layout="vertical" onFinish={handleUpdate}>
        <Form.Item
          name="modelName"
          label={
            <Tooltip title="Set the base large language model (LLM) you want to use for the chatbot. Any recommended models run entirely on UBC hardware and are safe for student data">
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
            <Tooltip title="Set the prompt that is attached with any chatbot question. You can specify what the course is, what the goals of your course are, how you want the chatbot to answer questions, etc.">
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
            <Tooltip title="This number determines the maximum number of text chunks the chatbot can retrieve and cite per question. Consider increasing it if the questions for your course generally require more chunks of context to answer properly.">
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
            <Tooltip title="Set the minimum similarity threshold when retrieving relevant information blocks. You can increase this if you notice that the chatbot is retrieving irrelevant documents, or decrease it if it's not grabbing the chunks that it should have. In general, this threshold should be left default or at a low value so the AI has more information to work with, rather than too little.">
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
          <Button onClick={handleReset} loading={loading || loadingModels}>
            Reset to default settings
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading || loadingModels}
          >
            Update settings
          </Button>
        </Space>
      </Form>
    </Modal>
  )
}

export default LegacyChatbotSettingsModal

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
