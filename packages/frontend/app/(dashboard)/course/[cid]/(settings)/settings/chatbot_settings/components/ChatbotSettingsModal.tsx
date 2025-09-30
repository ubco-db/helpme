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
} from '@koh/common'
import {
  InfoCircleOutlined,
  SettingOutlined,
  StarFilled,
  StarOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import ChatbotHelpTooltip from '@/app/(dashboard)/course/[cid]/(settings)/settings/components/ChatbotHelpTooltip'
import { ClearInputSuffix } from '@/app/(dashboard)/organization/ai/components/OrganizationChatbotSettingsForm'
import ChatbotModelInfoTooltip from '@/app/(dashboard)/components/ChatbotModelInfoTooltip'
import LLMTypeDisplay from '@/app/(dashboard)/organization/ai/components/LLMTypeDisplay'

interface ChatbotSettingsModalProps {
  open: boolean
  courseId: number
  onClose: () => void
  updateCourseSettings?: (settings: CourseChatbotSettings) => void
  preLoadedCourseSettings?: CourseChatbotSettings
  preLoadedProviders?: ChatbotProvider[]
}

const ChatbotSettingsModal: React.FC<ChatbotSettingsModalProps> = ({
  open,
  courseId,
  onClose,
  preLoadedProviders,
  preLoadedCourseSettings,
  updateCourseSettings,
}) => {
  const [form] = Form.useForm<CourseChatbotSettingsForm>()
  const [isLoadingData, setLoadingData] = useState(false)
  const [isPerformingAction, setIsPerformingAction] = useState(false)

  const [providers, setProviders] = useState<ChatbotProvider[] | undefined>(
    preLoadedProviders ?? undefined,
  )
  const [courseSettings, setCourseSettings] = useState<CourseChatbotSettings>(
    preLoadedCourseSettings || undefined!,
  )
  const [defaults, setDefaults] = useState<CourseChatbotSettingsForm>()

  const [formValues, setFormValues] = useState<CourseChatbotSettingsForm>({})
  const [onReload, setOnReload] = useState(false)

  const selectedLLM = useMemo(() => formValues['llmId'], [formValues])

  useEffect(() => {
    if (onReload) {
      const sets: Record<string, any> = { ...courseSettings }
      delete sets['defaultModel']
      form.setFieldsValue({
        ...sets,
      })
      setFormValues({
        ...sets,
      })
      setOnReload(false)
    }
  }, [courseSettings, form, onReload])

  useEffect(() => {
    if (courseSettings && !onReload) {
      const sets: Record<string, any> = { ...courseSettings }
      delete sets['defaultModel']
      form.setFieldsValue({ ...sets, ...formValues })
      setFormValues({ ...sets, ...formValues })
    }
  }, [courseSettings, form])

  const areParamsDefault = useMemo(() => {
    return courseSettings != undefined && defaults != undefined
      ? Object.keys(defaults)
          .map(
            (k) =>
              courseSettings[k as keyof CourseChatbotSettings] ==
              defaults[k as keyof CourseChatbotSettingsForm],
          )
          .reduce((p, c) => p && c, true)
      : false
  }, [courseSettings, defaults])

  const haveSettingsChanged = useMemo(() => {
    return courseSettings !== undefined
      ? Object.keys(formValues)
          .map(
            (k) =>
              formValues[k as keyof CourseChatbotSettingsForm] !=
              courseSettings[k as keyof CourseChatbotSettings],
          )
          .reduce((p, c) => p || c, false)
      : false
  }, [formValues, courseSettings])

  useEffect(() => {
    const getDefaults = () => {
      if (defaults != undefined) return
      return API.chatbot.staffOnly
        .getCourseSettingsDefaults(courseId)
        .then((response) => {
          setDefaults(response)
        })
        .catch((error) => {
          message
            .error('Failed to load defaults: ' + getErrorMessage(error))
            .then()
        })
    }

    const getProviders = () => {
      if (providers != undefined) return
      return API.chatbot.staffOnly
        .getCourseOrganizationProviders(courseId)
        .then((response) => {
          setProviders(response)
        })
        .catch((error) => {
          message
            .error('Failed to load available models: ' + getErrorMessage(error))
            .then()
        })
    }

    const getSettings = () => {
      if (courseSettings != undefined) return
      return API.chatbot.staffOnly
        .getCourseSettings(courseId)
        .then((response) => {
          setCourseSettings(response)
        })
        .catch((error) => {
          message
            .error(
              'Failed to load course chatbot settings: ' +
                getErrorMessage(error),
            )
            .then()
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
  }, [courseId, defaults, providers, courseSettings])

  useEffect(() => {
    if (courseSettings) {
      form.setFieldsValue({
        ...defaults,
        ...courseSettings,
      })
    }
  }, [courseSettings, defaults, form])

  const handleUpsert = (values: CourseChatbotSettingsForm) => {
    if (isPerformingAction) return
    setIsPerformingAction(true)

    API.chatbot.staffOnly
      .upsertCourseSettings(courseId, {
        ...values,
        llmId: selectedLLM,
      })
      .then((response) => {
        message
          .success(
            `Successfully ${courseSettings == undefined ? 'created' : 'updated'} course chatbot settings!`,
          )
          .then()
        setCourseSettings(response)
        if (updateCourseSettings) updateCourseSettings(response)
        setOnReload(true)
      })
      .catch((err) =>
        message.error(
          `Failed to update course chatbot settings: ${getErrorMessage(err)}`,
        ),
      )
      .finally(() => setIsPerformingAction(false))
  }

  const handleReset = () => {
    if (isPerformingAction) return
    setIsPerformingAction(true)

    API.chatbot.staffOnly
      .resetCourseSettings(courseId)
      .then((response) => {
        message.success(`Successfully reset course chatbot settings!`).then()
        setCourseSettings(response)
        if (updateCourseSettings) updateCourseSettings(response)
        setOnReload(true)
      })
      .catch((err) =>
        message.error(
          `Failed to reset course chatbot settings: ${getErrorMessage(err)}`,
        ),
      )
      .finally(() => setIsPerformingAction(false))
  }

  const clearFormValue = (key: string) => {
    const formKey = key as keyof CourseChatbotSettingsForm
    form.resetFields([formKey])
    form.setFieldsValue({
      [formKey]: null,
    })
    setFormValues((prev) => ({
      ...prev,
      [formKey]: defaults ? (defaults[formKey] ?? null) : null,
    }))
  }

  return (
    <>
      <style>{`
        .ant-form-item .ant-form-item-label > label {
          width: 100%;
        }
      `}</style>
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
          initialValues={{
            ...(defaults != undefined && courseSettings != undefined
              ? { ...defaults, ...courseSettings }
              : undefined),
            ...formValues,
          }}
          onValuesChange={(changedValues, values) => {
            const overwriteValues: Partial<CourseChatbotSettingsForm> = {}
            Object.keys(changedValues)
              .filter((k) =>
                [
                  'prompt',
                  'temperature',
                  'topK',
                  'similarityThresholdDocuments',
                ].includes(k),
              )
              .forEach((key) => {
                const formKey = key as keyof CourseChatbotSettingsForm
                let newValue = changedValues[key]
                if (newValue.trim() == '') {
                  overwriteValues[formKey] = null as any
                  return
                }

                const propertyName = key
                if (propertyName != 'prompt') {
                  newValue = newValue.trim()
                }
                switch (propertyName) {
                  case 'topK':
                    if (isNaN(parseInt(newValue))) {
                      overwriteValues[formKey] = formValues[formKey] as any
                    } else {
                      overwriteValues[formKey] = parseInt(newValue) as any
                    }
                    break
                  case 'temperature':
                  case 'similarityThresholdDocuments':
                    if (isNaN(parseFloat(newValue))) {
                      overwriteValues[formKey] = formValues[formKey] as any
                    } else {
                      overwriteValues[formKey] = parseFloat(newValue) as any
                    }
                    break
                  default:
                    overwriteValues[formKey] = newValue
                }
              })
            form.setFieldsValue(overwriteValues)
            setFormValues({
              llmId: selectedLLM,
              ...values,
              ...overwriteValues,
            })
          }}
          layout="vertical"
          onFinish={handleUpsert}
        >
          <div className={'flex flex-col'}>
            <div className={'ant-form-item'}>
              <div className={'ant-form-item-label'}>
                <label htmlFor={'llmId'}>
                  <div className={'flex w-full justify-between'}>
                    <Tooltip title="Set the base large language model (LLM) you want to use for the chatbot. Any recommended models run entirely on UBC hardware and are safe for student data">
                      Model <InfoCircleOutlined />
                    </Tooltip>
                    <Tooltip
                      title={
                        courseSettings?.usingDefaultModel
                          ? 'This parameter is synchronized with the organization settings.'
                          : 'This parameter is unique from the organization settings.'
                      }
                    >
                      {courseSettings?.usingDefaultModel ? (
                        <StarFilled className={'text-helpmeblue text-sm'} />
                      ) : (
                        <StarOutlined className={'text-sm text-gray-500'} />
                      )}
                    </Tooltip>
                  </div>
                </label>
              </div>
              <div className="flex gap-2">
                <Select
                  className={'w-full'}
                  id="llmId"
                  value={selectedLLM}
                  onSelect={(item) =>
                    setFormValues((prev) => ({ ...prev, ['llmId']: item }))
                  }
                >
                  {providers?.map((provider: ChatbotProvider, index0) => (
                    <Select.OptGroup
                      key={`${provider.nickname ?? `Provider ${index0 + 1}`} (${Object.keys(ChatbotServiceProvider).find((k) => (ChatbotServiceProvider as Record<string, string>)[k] == provider.providerType)})`}
                    >
                      {provider.availableModels
                        .filter((model) => model.isText)
                        .map((model, index1) => {
                          const { speed, quality, notes } =
                            getModelSpeedAndQualityEstimate(model)

                          return (
                            <Select.Option
                              key={`model-${index0}-${index1}`}
                              value={model.id}
                            >
                              <div>
                                <Tooltip
                                  title={
                                    <ChatbotModelInfoTooltip
                                      speed={speed}
                                      quality={quality}
                                      additionalNotes={[
                                        ...(model.providerNotes ?? []),
                                        ...(model.additionalNotes ?? []),
                                        ...notes,
                                      ]}
                                    />
                                  }
                                >
                                  <div className={'h-fit w-full'}>
                                    <LLMTypeDisplay
                                      model={model}
                                      isDefault={
                                        provider.defaultModel?.id == model.id
                                      }
                                      isDefaultVision={
                                        provider.defaultModel?.id == model.id
                                      }
                                      showModality={false}
                                    />
                                  </div>
                                </Tooltip>
                              </div>
                            </Select.Option>
                          )
                        })}
                    </Select.OptGroup>
                  ))}
                </Select>
                <ClearInputSuffix
                  formKey="llmId"
                  formValues={formValues}
                  defaultValues={defaults}
                  clearFormValue={clearFormValue}
                  icon={<SyncOutlined />}
                />
              </div>
            </div>

            <Form.Item
              name="prompt"
              label={
                <div className={'flex w-full justify-between'}>
                  <Tooltip title="Set the prompt that is attached with any chatbot question. This will apply to all courses if not modified.">
                    Prompt <InfoCircleOutlined />
                  </Tooltip>
                  <Tooltip
                    title={
                      courseSettings?.usingDefaultPrompt
                        ? 'This parameter is synchronized with the organization settings.'
                        : 'This parameter is unique from the organization settings.'
                    }
                  >
                    {courseSettings?.usingDefaultPrompt ? (
                      <StarFilled className={'text-helpmeblue text-sm'} />
                    ) : (
                      <StarOutlined className={'text-sm text-gray-500'} />
                    )}
                  </Tooltip>
                </div>
              }
              shouldUpdate={(prevValues, nextValues) =>
                prevValues !== nextValues
              }
            >
              <div className="flex flex-col items-end gap-2">
                <Input.TextArea
                  value={formValues['prompt'] as any}
                  className={'w-full'}
                  rows={6}
                  placeholder={'e.g., You are a course assistant.'}
                />
                <ClearInputSuffix
                  formKey="prompt"
                  formValues={formValues}
                  defaultValues={defaults}
                  clearFormValue={clearFormValue}
                  icon={<SyncOutlined />}
                />
              </div>
            </Form.Item>

            <Form.Item
              name="temperature"
              shouldUpdate={(prevValues, nextValues) =>
                prevValues !== nextValues
              }
              label={
                <div className={'flex w-full justify-between'}>
                  <Tooltip title="Adjust the temperature to control the randomness of the generation. Lower values make responses more predictable. Only applies for some models.">
                    Temperature <InfoCircleOutlined />
                  </Tooltip>
                  <Tooltip
                    title={
                      courseSettings?.usingDefaultTemperature
                        ? 'This parameter is synchronized with the organization settings.'
                        : 'This parameter is unique from the organization settings.'
                    }
                  >
                    {courseSettings?.usingDefaultTemperature ? (
                      <StarFilled className={'text-helpmeblue text-sm'} />
                    ) : (
                      <StarOutlined className={'text-sm text-gray-500'} />
                    )}
                  </Tooltip>
                </div>
              }
              rules={[
                {
                  required: false,
                  type: 'number',
                  min: 0,
                  max: 1,
                  message: 'Temperature must be between 0 and 1.',
                },
              ]}
            >
              <div className="flex flex-row gap-2">
                <InputNumber
                  value={formValues['temperature'] as any}
                  className={'w-full'}
                  placeholder={'A number from 0 to 1, e.g., 0.7'}
                  controls={false}
                />
                <ClearInputSuffix
                  formKey="temperature"
                  formValues={formValues}
                  defaultValues={defaults}
                  clearFormValue={clearFormValue}
                  icon={<SyncOutlined />}
                />
              </div>
            </Form.Item>

            <Form.Item
              name="topK"
              shouldUpdate={(prevValues, nextValues) =>
                prevValues !== nextValues
              }
              label={
                <div className={'flex w-full justify-between'}>
                  <Tooltip title="This number determines the maximum number of text chunks the chatbot can retrieve and cite per question. Consider increasing it if the questions for your course generally require more chunks of context to answer properly.">
                    Top-K Documents <InfoCircleOutlined />
                  </Tooltip>
                  <Tooltip
                    title={
                      courseSettings?.usingDefaultTopK
                        ? 'This parameter is synchronized with the organization settings.'
                        : 'This parameter is unique from the organization settings.'
                    }
                  >
                    {courseSettings?.usingDefaultTopK ? (
                      <StarFilled className={'text-helpmeblue text-sm'} />
                    ) : (
                      <StarOutlined className={'text-sm text-gray-500'} />
                    )}
                  </Tooltip>
                </div>
              }
              rules={[
                {
                  type: 'number',
                  required: false,
                  min: 1,
                  message:
                    'Top-K must be at least 1 for at least 1 document to be retrieved.',
                },
              ]}
            >
              <div className="flex flex-row gap-2">
                <InputNumber
                  value={formValues['topK'] as any}
                  className={'w-full'}
                  placeholder={'An integer, e.g., 5'}
                  controls={false}
                />
                <ClearInputSuffix
                  formKey="topK"
                  formValues={formValues}
                  defaultValues={defaults}
                  clearFormValue={clearFormValue}
                  icon={<SyncOutlined />}
                />
              </div>
            </Form.Item>

            <Form.Item
              name="similarityThresholdDocuments"
              shouldUpdate={(prevValues, nextValues) =>
                prevValues !== nextValues
              }
              label={
                <div className={'flex w-full justify-between'}>
                  <Tooltip title="Set the minimum similarity threshold when retrieving relevant information blocks. You can increase this if you notice that the chatbot is retrieving irrelevant documents, or decrease it if it's not grabbing the chunks that it should have. In general, this threshold should be left default or at a low value so the AI has more information to work with, rather than too little.">
                    Similarity Threshold for Documents <InfoCircleOutlined />
                  </Tooltip>
                  <Tooltip
                    title={
                      courseSettings?.usingDefaultSimilarityThresholdDocuments
                        ? 'This parameter is synchronized with the organization settings.'
                        : 'This parameter is unique from the organization settings.'
                    }
                  >
                    {courseSettings?.usingDefaultSimilarityThresholdDocuments ? (
                      <StarFilled className={'text-helpmeblue text-sm'} />
                    ) : (
                      <StarOutlined className={'text-sm text-gray-500'} />
                    )}
                  </Tooltip>
                </div>
              }
              rules={[
                {
                  required: false,
                  type: 'number',
                  min: 0,
                  max: 1,
                  message:
                    'Similarity threshold for documents must be between 0 and 1.',
                },
              ]}
              className={'w-full'}
            >
              <div className="flex flex-row gap-2">
                <InputNumber
                  value={formValues['similarityThresholdDocuments'] as any}
                  className={'w-full'}
                  placeholder={'A number from 0 to 1, e.g., 0.55'}
                  controls={false}
                />
                <ClearInputSuffix
                  formKey="similarityThresholdDocuments"
                  formValues={formValues}
                  defaultValues={defaults}
                  clearFormValue={clearFormValue}
                  icon={<SyncOutlined />}
                />
              </div>
            </Form.Item>
          </div>

          <Space className="flex justify-end">
            <Tooltip
              title={
                areParamsDefault &&
                'All parameters are already their default value.'
              }
            >
              <Button
                onClick={handleReset}
                loading={isLoadingData || isPerformingAction}
                disabled={areParamsDefault}
              >
                Reset to default settings
              </Button>
            </Tooltip>
            <Tooltip title={!haveSettingsChanged && 'No changes detected.'}>
              <Button
                type="primary"
                htmlType="submit"
                loading={isLoadingData || isPerformingAction}
                disabled={!haveSettingsChanged}
              >
                Update settings
              </Button>
            </Tooltip>
          </Space>
        </Form>
      </Modal>
    </>
  )
}

export default ChatbotSettingsModal
