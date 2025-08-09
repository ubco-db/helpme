import { cn, getErrorMessage } from '@/app/utils/generalUtils'
import {
  Button,
  Card,
  Form,
  Input,
  List,
  message,
  Popconfirm,
  Select,
  Tooltip,
} from 'antd'
import {
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  FrownOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  InfoCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import {
  ChatbotAllowedHeaders,
  ChatbotProvider,
  ChatbotServiceProvider,
  CreateChatbotProviderBody,
  CreateLLMTypeBody,
  LLMType,
  UpdateChatbotProviderBody,
  UpdateLLMTypeBody,
} from '@koh/common'
import { useEffect, useMemo, useState } from 'react'
import LLMTypeDisplay from './LLMTypeDisplay'
import AddModelModal from '@/app/(dashboard)/organization/ai/components/AddModelModal'
import ChatbotHeadersTable from '@/app/(dashboard)/organization/ai/components/ChatbotHeadersTable'
import { API } from '@/app/api'
import AdditionalNotesList from '@/app/(dashboard)/organization/ai/components/AdditionalNotesList'

type UpsertChatbotProviderProps = {
  organizationId: number
  // Whether it's submitted through organization settings creation or not
  canSelfSubmit: boolean
  // For Creation
  props?: CreateChatbotProviderBody
  onSubmit: (provider: CreateChatbotProviderBody) => void
  // For Updating
  provider?: ChatbotProvider
  setProvider?: (provider: ChatbotProvider) => void
  // Modal Properties
  onClose: () => void
}

const UpsertChatbotProvider: React.FC<UpsertChatbotProviderProps> = ({
  organizationId,
  canSelfSubmit,
  props,
  onSubmit,
  provider,
  setProvider,
  onClose,
}) => {
  const [form] = Form.useForm<
    CreateChatbotProviderBody | UpdateChatbotProviderBody
  >()

  const [models, setModels] = useState<LLMType[]>([])
  const [headers, setHeaders] = useState<ChatbotAllowedHeaders | undefined>(
    provider?.headers ?? props?.headers,
  )
  const [isLoading, setIsLoading] = useState(false)
  const [addModelModalOpen, setAddModelModalOpen] = useState(false)
  const [isActionsMinimized, setIsActionsMinimized] = useState(false)

  const [providerType, setProviderType] = useState<ChatbotServiceProvider>()
  const [baseUrl, setBaseUrl] = useState<string>()
  const [apiKey, setApiKey] = useState<string>()
  const [defaultModelName, setDefaultModelName] = useState<string>()
  const [defaultVisionModelName, setDefaultVisionModelName] = useState<string>()

  const [editingApiKey, setEditingApiKey] = useState(false)
  const [calculateModels, setCalculateModels] = useState(false)

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [])

  useEffect(() => {
    if (provider) {
      form.setFieldsValue({
        ...provider,
      })
      setProviderType(provider.providerType)
      setBaseUrl(provider.baseUrl)
      setDefaultModelName(provider.defaultModel.modelName)
      setDefaultVisionModelName(provider.defaultVisionModel.modelName)
      setModels(
        provider.availableModels.map((v) => ({
          ...v,
        })),
      )
    }
  }, [form, provider])

  useEffect(() => {
    if (props) {
      form.setFieldsValue({
        ...props,
      })
      setProviderType(props.providerType)
      setDefaultModelName(props.defaultModelName)
      setDefaultVisionModelName(props.defaultVisionModelName)
      setModels(
        props.models.map(
          (m, i) =>
            ({
              ...m,
              id: i,
              provider: null!,
            }) satisfies LLMType,
        ),
      )
    }
  }, [form, props])

  const changeProviderType = (newType: ChatbotServiceProvider) => {
    if (newType != providerType) {
      form.setFieldsValue({
        baseUrl: undefined,
      })
      setDefaultModelName(undefined)
      setDefaultVisionModelName(undefined)
      setModels([])
    }
  }

  const setProviderDefaultModel = (modelName: string, vision = false) => {
    if (vision) {
      setDefaultVisionModelName(modelName)
    } else {
      setDefaultModelName(modelName)
    }
  }

  const handleAddModel = (model: LLMType) => {
    setModels((prev) => {
      if (model.isText && prev.filter((m) => m.isText).length == 0) {
        setProviderDefaultModel(model.modelName)
      }
      if (model.isVision && prev.filter((m) => m.isVision).length == 0) {
        setProviderDefaultModel(model.modelName, true)
      }
      return [...prev, model]
    })
  }

  const handleRemoveModel = (modelName: string) => {
    if (defaultModelName == modelName) {
      return message.warning(
        'Cannot remove model as it is the default option for text input.',
      )
    }
    if (defaultVisionModelName == modelName) {
      return message.warning(
        'Cannot remove model as it is the default option for visual input.',
      )
    }
    setModels((prev) => prev.filter((m) => m.modelName != modelName))
  }

  const handleHeaderUpdate = (h: ChatbotAllowedHeaders) => {
    setHeaders(h)
  }

  const getAddedModels = () => {
    return (
      models.filter(
        (m0) =>
          !(provider?.availableModels ?? []).some(
            (m1) => m1.modelName == m0.modelName,
          ),
      ) ?? []
    )
  }

  const addedModels = useMemo(
    () => getAddedModels(),
    [provider, models, calculateModels],
  )

  const getModifiedModels = () => {
    if (provider === undefined) return {}
    const mods: Record<number, UpdateLLMTypeBody> = {}
    models
      .map((m0) => ({
        m0,
        m1: provider.availableModels.find((m1) => m1.modelName == m0.modelName),
      }))
      .forEach(({ m0, m1 }) => {
        const model = m0
        const original = m1
        if (!original) return
        if (
          model.isText != original.isText ||
          model.isVision != original.isVision ||
          model.isThinking != original.isThinking ||
          model.isRecommended != original.isRecommended ||
          JSON.stringify(model?.additionalNotes ?? []) !=
            JSON.stringify(original?.additionalNotes ?? [])
        )
          mods[original.id] = {
            isRecommended: model.isRecommended,
            isText: model.isText,
            isVision: model.isVision,
            isThinking: model.isThinking,
            additionalNotes: model.additionalNotes,
          }
      })
    return mods
  }

  const modifiedModels = useMemo(
    () => getModifiedModels(),
    [models, provider, calculateModels],
  )

  const getDeletedModels = () => {
    return (
      provider?.availableModels
        .filter((m0) => !models.find((m1) => m1.modelName == m0.modelName))
        .map((m) => m.id) ?? []
    )
  }

  const deletedModels = useMemo(
    () => getDeletedModels(),
    [provider, models, calculateModels],
  )

  const handleFinish = () => {
    if (isLoading) return
    setIsLoading(true)
    form
      .validateFields()
      .then((values) => {
        if (models.length == 0) {
          message.error('Provider must have at least one model')
          return
        }

        if (
          !defaultModelName ||
          !models.some((m) => m.modelName == defaultModelName)
        ) {
          message.error('Provider is missing default text model')
          return
        }

        if (
          !defaultVisionModelName ||
          !models.some((m) => m.modelName == defaultVisionModelName)
        ) {
          message.error('Provider is missing default vision model')
          return
        }

        if (!canSelfSubmit) {
          try {
            onSubmit({
              ...(values as CreateChatbotProviderBody),
              headers,
              models,
              defaultVisionModelName: defaultVisionModelName ?? '',
              defaultModelName: defaultModelName ?? '',
              additionalNotes: notes,
            })
          } catch (err) {
            message.error(getErrorMessage(err))
          }
          return
        }

        if (provider != undefined) {
          if (!editingApiKey) {
            values = { ...values, apiKey: undefined }
          }

          const addedModels = getAddedModels()
          const modifiedModels = getModifiedModels()
          const deletedModels = getDeletedModels()
          API.chatbot.adminOnly
            .updateChatbotProvider(organizationId, provider.id, {
              ...values,
              headers,
              defaultModelName,
              defaultVisionModelName,
              addedModels,
              deletedModels,
              modifiedModels,
              additionalNotes: notes,
            })
            .then((provider) => {
              message.success('Successfully updated chatbot provider!')
              if (setProvider) setProvider(provider)
              onClose()
            })
            .catch((err) => {
              message.error(
                `Failed to update chatbot provider: ${getErrorMessage(err)}`,
              )
            })
            .finally(() => {
              setIsLoading(false)
            })
        } else {
          API.chatbot.adminOnly
            .createChatbotProvider(organizationId, {
              ...(values as CreateChatbotProviderBody),
              headers,
              defaultModelName,
              defaultVisionModelName,
              models,
              additionalNotes: notes,
            })
            .then((provider) => {
              message.success('Successfully created chatbot provider!')
              if (setProvider) setProvider(provider)
              onClose()
            })
            .catch((err) => {
              message.error(
                `Failed to create chatbot provider: ${getErrorMessage(err)}`,
              )
            })
            .finally(() => {
              setIsLoading(false)
            })
        }
      })
      .catch(() => {
        message.error('Invalid parameters')
        setIsLoading(false)
      })
      .finally(() => setIsLoading(false))
  }

  const [notes, setNotes] = useState<string[]>(provider?.additionalNotes ?? [])

  useEffect(() => {
    if (provider?.additionalNotes) {
      setNotes(provider.additionalNotes)
    }
  }, [provider?.additionalNotes])

  const haveNotesChanged = useMemo(
    () =>
      JSON.stringify(provider?.additionalNotes ?? []) !== JSON.stringify(notes),
    [provider?.additionalNotes, notes],
  )

  const haveSettingsChanged = useMemo(() => {
    return provider !== undefined
      ? providerType != provider.providerType ||
          baseUrl != provider.baseUrl ||
          apiKey != undefined ||
          defaultModelName != provider.defaultModel.modelName ||
          defaultVisionModelName != provider.defaultVisionModel.modelName ||
          haveNotesChanged ||
          addedModels.length > 0 ||
          Object.keys(modifiedModels).length > 0 ||
          deletedModels.length > 0
      : false
  }, [
    provider,
    providerType,
    baseUrl,
    apiKey,
    defaultModelName,
    defaultVisionModelName,
    haveNotesChanged,
    addedModels,
    modifiedModels,
    deletedModels,
  ])

  const providerNames = useMemo(
    () => Object.keys(ChatbotServiceProvider).join(', '),
    [],
  )

  return (
    <div className={'flex flex-col gap-8'}>
      <Card
        title={
          provider != undefined
            ? 'Editing Chatbot Provider'
            : 'Creating Chatbot Provider'
        }
      >
        <Form
          form={form}
          initialValues={
            (provider && {
              ...provider,
            }) ||
            (props && {
              ...props,
            })
          }
          onValuesChange={(changedValues) => {
            for (const key in changedValues) {
              switch (key) {
                case 'providerType':
                  changeProviderType(changedValues[key])
                  setProviderType(changedValues[key])
                  break
                case 'baseUrl':
                  setBaseUrl(changedValues[key])
                  break
                case 'apiKey':
                  setApiKey(changedValues[key])
                  break
              }
            }
          }}
        >
          <Form.Item
            name="providerType"
            label={
              <Tooltip
                title={`The service provider for this provider configuration. Can be any of: ${providerNames}.`}
              >
                Chatbot Service Provider <InfoCircleOutlined />
              </Tooltip>
            }
            rules={[
              { required: true, message: 'Please select a provider type' },
            ]}
          >
            <Select>
              {Object.keys(ChatbotServiceProvider).map((key) => (
                <Select.Option
                  key={`provider-option-${key}`}
                  value={
                    ChatbotServiceProvider[
                      key as keyof typeof ChatbotServiceProvider
                    ]
                  }
                >
                  {key}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="nickname"
            label={
              <Tooltip
                title={`Set a nickname that is used purely for organizational/appearance purposes.`}
              >
                Nickname <InfoCircleOutlined />
              </Tooltip>
            }
            rules={[
              {
                required: false,
                type: 'string',
                max: 16,
                message: 'Nickname cannot exceed 16 characters in length.',
              },
            ]}
          >
            <Input />
          </Form.Item>

          {providerType && (
            <>
              {providerType !== ChatbotServiceProvider.OpenAI && (
                <Form.Item
                  label={
                    <Tooltip
                      title={`The base URL which the service can be reached at.`}
                    >
                      Base URL <InfoCircleOutlined />
                    </Tooltip>
                  }
                  name="baseUrl"
                  rules={[
                    {
                      required: true,
                      type: 'string',
                      message: 'Base URL is required for this provider.',
                    },
                  ]}
                >
                  <Input addonBefore={'https://'} />
                </Form.Item>
              )}
              {providerType == ChatbotServiceProvider.OpenAI &&
                (provider != undefined &&
                provider.hasApiKey &&
                !editingApiKey ? (
                  <Form.Item
                    label={
                      <Tooltip
                        title={`The API key necessary to access the service. Stored securely and never returned.`}
                      >
                        API Key <InfoCircleOutlined />
                      </Tooltip>
                    }
                  >
                    <div className="flex flex-row gap-2">
                      <Input
                        className={'w-full'}
                        value={'*******************************************'}
                        disabled={true}
                      />
                      <Popconfirm
                        title={
                          "Are you sure? You'll overwrite the existing API key."
                        }
                        okText={'Edit API Key'}
                        onConfirm={() => setEditingApiKey(true)}
                      >
                        <Button icon={<EditOutlined />} />
                      </Popconfirm>
                    </div>
                  </Form.Item>
                ) : (
                  <Form.Item
                    label={
                      <Tooltip
                        title={`The API key necessary to access the service. Stored securely and never returned.`}
                      >
                        API Key <InfoCircleOutlined />
                      </Tooltip>
                    }
                    name="apiKey"
                    rules={[
                      {
                        required: true,
                        type: 'string',
                        message: 'API Key is required for this provider.',
                      },
                    ]}
                  >
                    <div className="flex flex-row gap-2">
                      <Input.Password className={'w-full'} />
                      {provider != undefined && provider.hasApiKey && (
                        <Popconfirm
                          title={
                            "Are you sure? Any changes already to the API key won't be saved."
                          }
                          okText={'Cancel API Key Edit'}
                          onConfirm={() => setEditingApiKey(false)}
                        >
                          <Button icon={<CloseOutlined />} />
                        </Popconfirm>
                      )}
                    </div>
                  </Form.Item>
                ))}
            </>
          )}
          <div className={'ant-form-item'}>
            <div className={'ant-form-item-label'}>
              <label className={'w-full'}>
                <div className={'flex'}>
                  <Tooltip title="Set additional notes for this provider. These will appear in model selection for all models of this provider.">
                    Additional Notes <InfoCircleOutlined />
                  </Tooltip>
                </div>
              </label>
            </div>
            <AdditionalNotesList
              notes={notes}
              setNotes={setNotes}
              initialNotes={provider?.additionalNotes}
              allowNoteEditing={true}
              bordered={true}
            />
          </div>
        </Form>
      </Card>
      <Card title={'Available Models'}>
        {!providerType && (
          <div
            className={
              'flex flex-col items-center justify-center gap-1 text-gray-400'
            }
          >
            <FrownOutlined className={'text-xl'} />
            <p>A provider type is required to add models.</p>
            <p className={'w-full md:w-1/2'}>
              Once you select a provider, you will be given the option to add
              models to this provider. Depending on the provider, you will need
              to have an accurate base URL and headers for the list of available
              models to be successfully retrieved.
            </p>
          </div>
        )}
        {providerType && (
          <List
            locale={{
              emptyText: (
                <div
                  className={
                    'flex flex-col items-center justify-center gap-1 text-gray-400'
                  }
                >
                  <FrownOutlined className={'text-xl'} />
                  <p>No models added.</p>
                  <p className={'w-full md:w-1/2'}>
                    Click &#39;Add Model&#39; to open the interface where you
                    can add them. You&#39;ll be provided with a list of models
                    from this provider automatically. If your configuration is
                    invalid, the list of models won&#39;t be able to be
                    retrieved.
                  </p>
                </div>
              ),
            }}
            dataSource={models}
            renderItem={(item: CreateLLMTypeBody) => {
              const isDefaultModel = defaultModelName == item.modelName
              const isDefaultVisionModel =
                defaultVisionModelName == item.modelName
              return (
                <List.Item>
                  <div
                    className={
                      'my-2 box-border flex h-fit w-full gap-2 rounded-md border-2 border-gray-200 p-2 shadow-md'
                    }
                  >
                    <LLMTypeDisplay
                      model={item}
                      isDefault={isDefaultModel}
                      isDefaultVision={isDefaultVisionModel}
                      setDefault={(modelName: string, vision?: boolean) =>
                        setProviderDefaultModel(modelName, vision)
                      }
                      showNotes={true}
                      allowNoteEditing={true}
                      allowRecommendedEdit={true}
                      onUpdateRecommended={(
                        modelName: string,
                        isRecommended: boolean,
                      ) => {
                        setModels((prev) => {
                          const idx = prev.findIndex(
                            (m) => m.modelName == modelName,
                          )
                          if (idx >= 0) {
                            prev[idx] = {
                              ...prev[idx],
                              isRecommended,
                            }
                          }
                          return prev
                        })
                        setCalculateModels(!calculateModels)
                      }}
                      onUpdateNotes={(modelName, notes) => {
                        setModels((prev) => {
                          const idx = prev.findIndex(
                            (m) => m.modelName == modelName,
                          )
                          if (idx >= 0) {
                            prev[idx] = {
                              ...prev[idx],
                              additionalNotes: notes,
                            }
                          }
                          return prev
                        })
                        setCalculateModels(!calculateModels)
                      }}
                    />
                    <Button
                      className={'justify-self-start'}
                      icon={<DeleteOutlined />}
                      danger
                      onClick={() => handleRemoveModel(item.modelName)}
                    >
                      Remove
                    </Button>
                  </div>
                </List.Item>
              )
            }}
            footer={
              <div className={'flex justify-end'}>
                <Button
                  icon={<PlusOutlined />}
                  onClick={() => setAddModelModalOpen(true)}
                >
                  Add Model
                </Button>
                <AddModelModal
                  providerType={providerType}
                  organizationId={organizationId}
                  inUseModels={models}
                  baseUrl={baseUrl}
                  apiKey={apiKey}
                  onAdd={(llmType) => handleAddModel(llmType)}
                  open={addModelModalOpen}
                  onClose={() => setAddModelModalOpen(false)}
                />
              </div>
            }
          />
        )}
      </Card>
      {providerType && providerType != ChatbotServiceProvider.OpenAI && (
        <Card title={'Request Headers'}>
          <ChatbotHeadersTable
            initialHeaders={provider?.headers ?? props?.headers}
            setUpdatedHeaders={(headers: ChatbotAllowedHeaders) =>
              handleHeaderUpdate(headers)
            }
          />
        </Card>
      )}
      <div className={'sticky bottom-2'}>
        <div className={'flex w-full justify-end'}>
          <Card
            variant={'borderless'}
            className={
              'w-full border-2 border-solid border-gray-200 drop-shadow-2xl md:w-1/3'
            }
            classNames={{
              body: cn(
                isActionsMinimized ? 'hidden' : 'flex',
                'flex-col-reverse gap-2 justify-center',
              ),
            }}
            title={
              <div className={'flex w-full justify-between'}>
                <span className={'text-center text-xl font-semibold'}>
                  Actions
                </span>
                <Button
                  icon={
                    isActionsMinimized ? (
                      <FullscreenOutlined />
                    ) : (
                      <FullscreenExitOutlined />
                    )
                  }
                  onClick={() => setIsActionsMinimized(!isActionsMinimized)}
                />
              </div>
            }
          >
            <Button type={'default'} disabled={isLoading} onClick={onClose}>
              Cancel
            </Button>
            <Tooltip
              title={
                provider != undefined &&
                !haveSettingsChanged &&
                'No changes detected.'
              }
            >
              <Button
                type={'primary'}
                htmlType={'submit'}
                loading={isLoading}
                onClick={handleFinish}
                disabled={provider != undefined && !haveSettingsChanged}
              >
                {provider != undefined ? 'Confirm Edits' : 'Create Provider'}
              </Button>
            </Tooltip>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default UpsertChatbotProvider
