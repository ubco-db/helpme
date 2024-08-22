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
} from 'antd'
import {
  InfoCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import axios from 'axios'
import { useUserInfo } from '@/app/contexts/userContext'

interface ChatbotSettingsModalProps {
  open: boolean
  courseId: number
  onClose: () => void
}

interface AvailableModelTypes {
  [key: string]: string
}

interface ChatbotSettings {
  id: string
  AvailableModelTypes: AvailableModelTypes
  pageContent: string
  metadata: {
    modelName: string
    prompt: string
    similarityThresholdDocuments: number
    temperature: number
    topK: number
  }
}

const ChatbotSettingsModal: React.FC<ChatbotSettingsModalProps> = ({
  open,
  courseId,
  onClose,
}) => {
  const [form] = Form.useForm()
  const { userInfo } = useUserInfo()
  const [loading, setLoading] = useState(false)
  const [availableModels, setAvailableModels] = useState<AvailableModelTypes>(
    {},
  )

  const fetchChatbotSettings = useCallback(async () => {
    console.log('fetchChatbotSettings')
    try {
      setLoading(true)
      const response = await axios.get<ChatbotSettings>(
        `/chat/${courseId}/oneChatbotSetting`,
        {
          headers: { HMS_API_TOKEN: userInfo.chat_token.token },
        },
      )
      setAvailableModels(response.data.AvailableModelTypes)
      form.setFieldsValue({
        ...response.data.metadata,
      })
    } catch (error) {
      message.error('Failed to load chatbot settings')
    } finally {
      setLoading(false)
    }
  }, [courseId, userInfo.chat_token.token, form])

  useEffect(() => {
    if (open && courseId) {
      fetchChatbotSettings()
    }
  }, [open, courseId, fetchChatbotSettings])

  const handleUpdate = async (values: any) => {
    const updateData = {
      modelName: values.modelName,
      prompt: values.prompt,
      similarityThresholdDocuments: values.similarityThresholdDocuments,
      temperature: values.temperature,
      topK: values.topK,
    }

    try {
      setLoading(true)
      await axios.patch(`/chat/${courseId}/updateChatbotSetting`, updateData, {
        headers: { HMS_API_TOKEN: userInfo.chat_token.token },
      })

      message.success('Settings updated successfully')
      onClose()
    } catch (error) {
      message.error('Failed to update settings')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    Modal.confirm({
      title: 'Are you sure reset the chatbot settings?',
      icon: <ExclamationCircleOutlined />,
      content:
        'This will revert all settings to their default values and cannot be undone.',
      onOk: async () => {
        setLoading(true)
        try {
          await axios.patch(
            `/chat/${courseId}/resetChatbotSetting`,
            {},
            {
              headers: { HMS_API_TOKEN: userInfo.chat_token.token },
            },
          )
          message.success('Settings have been reset successfully')
          fetchChatbotSettings() // Reload settings to update UI
        } catch (error) {
          message.error('Failed to reset settings')
        } finally {
          setLoading(false)
        }
      },
    })
  }

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
            <Tooltip title="Select the base large language model you want.">
              Model Name <InfoCircleOutlined />
            </Tooltip>
          }
          rules={[{ required: true, message: 'Please input the model name!' }]}
        >
          <Select>
            {Object.entries(availableModels).map(([key, value]) => (
              <Select.Option
                key={key}
                value={value}
              >{`${key}: ${value}`}</Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="prompt"
          label={
            <Tooltip title="Input the default prompt that the model will use to initiate conversations.">
              Prompt <InfoCircleOutlined />
            </Tooltip>
          }
          rules={[{ required: true, message: 'Please input the prompt!' }]}
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
            <Tooltip title="This number influences the max number of information blocks the chatbot would retrieve per question.">
              Top K <InfoCircleOutlined />
            </Tooltip>
          }
          rules={[{ required: true, message: 'Please input the top K!' }]}
        >
          <InputNumber />
        </Form.Item>

        <Form.Item
          name="similarityThresholdDocuments"
          label={
            <Tooltip title="Set the minimum similarity threshold when retrieving relevant information blocks.">
              Similarity Threshold Documents <InfoCircleOutlined />
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

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>
              Update settings
            </Button>
            <Button onClick={handleReset} loading={loading}>
              Reset to default settings
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default ChatbotSettingsModal
