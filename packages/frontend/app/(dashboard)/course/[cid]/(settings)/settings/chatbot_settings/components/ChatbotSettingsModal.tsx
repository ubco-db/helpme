import { useEffect, useMemo, useState } from 'react'
import { API } from '@/app/api'
import {
  Button,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Space,
  Tooltip,
} from 'antd'
import {
  getErrorMessage,
  getModelSpeedAndQualityEstimate,
} from '@/app/utils/generalUtils'
import {
  ChatbotProvider,
  ChatbotServiceProvider,
  CourseChatbotSettings,
  CourseChatbotSettingsForm,
  LLMType,
} from '@koh/common'
import { InfoCircleOutlined, SettingOutlined } from '@ant-design/icons'
import ChatbotHelpTooltip from '@/app/(dashboard)/course/[cid]/(settings)/settings/components/ChatbotHelpTooltip'
import ChatbotModelInfoTooltip from '@/app/(dashboard)/components/ChatbotModelInfoTooltip'
import LLMTypeDisplay from '@/app/(dashboard)/organization/ai/components/LLMTypeDisplay'
import LLMSelect from '@/app/(dashboard)/organization/ai/components/LLMSelect'

interface ChatbotSettingsModalProps {
  open: boolean
  organizationId: number
  courseId: number
  onClose: () => void
}

const ChatbotSettingsModal: React.FC<ChatbotSettingsModalProps> = ({
  open,
  organizationId,
  courseId,
  onClose,
}) => {
  const [form] = Form.useForm<CourseChatbotSettingsForm>()
  const [isLoadingData, setLoadingData] = useState(false)
  const [isPerformingAction, _setIsPerformingAction] = useState(false)

  const [providers, setProviders] = useState<ChatbotProvider[]>([])
  const [courseSettings, setCourseSettings] = useState<CourseChatbotSettings>()
  const [defaults, setDefaults] = useState<CourseChatbotSettingsForm>()

  useEffect(() => {
    const getDefaults = () => {
      return API.chatbot.staffOnly
        .getCourseSettingsDefaults(courseId)
        .then((response) => {
          setDefaults(response)
        })
        .catch((error) => {
          message.error('Failed to load defaults: ' + getErrorMessage(error))
        })
    }

    const getProviders = () => {
      return API.chatbot.staffOnly
        .getCourseOrganizationProviders(courseId)
        .then((response) => {
          setProviders(response)
        })
        .catch((error) => {
          message.error(
            'Failed to load available models: ' + getErrorMessage(error),
          )
        })
    }

    const getSettings = () => {
      return API.chatbot.staffOnly
        .getCourseSettings(courseId)
        .then((response) => {
          setCourseSettings(response)
        })
        .catch((error) => {
          message.error(
            'Failed to load course chatbot settings: ' + getErrorMessage(error),
          )
        })
    }

    const fetchData = async () => {
      setLoadingData(true)
      await Promise.all([
        await getSettings(),
        await getDefaults(),
        await getProviders(),
      ]).finally(() => {
        setLoadingData(false)
      })
    }

    fetchData().then()
  }, [courseId])

  useEffect(() => {
    if (courseSettings) {
      form.setFieldsValue({
        ...defaults,
        ...courseSettings,
      })
    }
  }, [courseSettings, defaults, form])

  const handleUpsert = (values: CourseChatbotSettingsForm) => {
    API.chatbot.staffOnly
      .upsertCourseSettings(organizationId, courseId, {
        ...values,
      })
      .then((response) => {
        message.success(
          `Successfully ${courseSettings == undefined ? 'created' : 'updated'} course chatbot settings!`,
        )
        setCourseSettings(response)
      })
      .catch((err) =>
        message.error(
          `Failed to update course chatbot settings: ${getErrorMessage(err)}`,
        ),
      )
  }

  const handleReset = () => {
    API.chatbot.staffOnly
      .resetCourseSettings(organizationId, courseId)
      .then((response) => {
        message.success(`Successfully reset course chatbot settings!`)
        setCourseSettings(response)
      })
      .catch((err) =>
        message.error(
          `Failed to reset course chatbot settings: ${getErrorMessage(err)}`,
        ),
      )
  }

  return (
    <Modal
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
      <Form
        form={form}
        initialValues={
          defaults != undefined && courseSettings != undefined
            ? { ...defaults, ...courseSettings }
            : undefined
        }
        layout="vertical"
        onFinish={handleUpsert}
      >
        <Form.Item
          name="llmId"
          label={
            <Tooltip title="Set the base large language model (LLM) you want to use for the chatbot. Any recommended models run entirely on UBC hardware and are safe for student data">
              Model <InfoCircleOutlined />
            </Tooltip>
          }
          rules={[{ required: true, message: 'Please select a model' }]}
        >
          <LLMSelect providers={providers} />
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
          <Button
            onClick={handleReset}
            loading={isLoadingData || isPerformingAction}
          >
            Reset to default settings
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={isLoadingData || isPerformingAction}
          >
            Update settings
          </Button>
        </Space>
      </Form>
    </Modal>
  )
}

export default ChatbotSettingsModal
