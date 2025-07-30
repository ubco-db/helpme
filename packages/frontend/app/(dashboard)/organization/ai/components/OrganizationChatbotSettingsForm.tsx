import { API } from '@/app/api'
import {
  ChatbotAllowedHeaders,
  ChatbotProvider,
  ChatbotServiceProvider,
  CreateChatbotProviderBody,
  CreateLLMTypeBody,
  LLMType,
  OrganizationChatbotSettings,
  OrganizationChatbotSettingsDefaults,
} from '@koh/common'
import {
  Button,
  Card,
  Collapse,
  Divider,
  Form,
  Input,
  InputNumber,
  List,
  message,
  Statistic,
  Table,
  Tooltip,
} from 'antd'
import { useEffect, useMemo, useState } from 'react'
import {
  DeleteOutlined,
  EditOutlined,
  FrownOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons'
import UpsertChatbotProvider from '@/app/(dashboard)/organization/ai/components/UpsertChatbotProvider'
import LLMTypeDisplay from '@/app/(dashboard)/organization/ai/components/LLMTypeDisplay'
import {
  cn,
  getErrorMessage,
  getModelSpeedAndQualityEstimate,
} from '@/app/utils/generalUtils'
import AdditionalNotesList from '@/app/(dashboard)/organization/ai/components/AdditionalNotesList'
import ChatbotModelInfoTooltip from '@/app/(dashboard)/components/ChatbotModelInfoTooltip'

type OrganizationChatbotSettingsFormProps = {
  organizationId: number
  organizationSettings?: OrganizationChatbotSettings
  setSettings?: (settings: OrganizationChatbotSettings) => void
}

const OrganizationChatbotSettingsForm: React.FC<
  OrganizationChatbotSettingsFormProps
> = ({ organizationId, organizationSettings, setSettings }) => {
  const [form] = Form.useForm<OrganizationChatbotSettingsDefaults>()

  const [createProviders, setCreateProviders] = useState<
    CreateChatbotProviderBody[]
  >([])

  // States for when in INSERT mode
  const [editingCreateProvider, setEditingCreateProvider] = useState<
    { props: CreateChatbotProviderBody; index: number } | undefined
  >()
  const [isCreatingCreateProvider, setIsCreatingCreateProvider] =
    useState(false)

  // States for when in UPDATE mode
  const [editingProvider, setEditingProvider] = useState<ChatbotProvider>()
  const [creatingProvider, setCreatingProvider] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [isActionsMinimized, setIsActionsMinimized] = useState(false)
  const [isDeleteProviderLoading, setIsDeleteProviderLoading] = useState(false)

  // Default Provider (Changes depending on whether settings exist or not)
  const [defaultProvider, setDefaultProvider] = useState<number>(
    organizationSettings != undefined
      ? organizationSettings.defaultProvider?.id
      : 0,
  )

  useEffect(() => {
    if (organizationSettings && organizationSettings.defaultProvider) {
      setDefaultProvider(organizationSettings.defaultProvider.id)
    }
    if (organizationSettings) {
      const sets: Record<string, any> = { ...organizationSettings }
      delete sets['defaultProvider']
      delete sets['courseSettingsInstances']
      delete sets['providers']
      form.setFieldsValue({ ...sets, ...formValues })
      setFormValues({ ...sets, ...formValues })
    }
  }, [organizationSettings, organizationSettings?.defaultProvider])

  const [onReload, setOnReload] = useState(false)
  useEffect(() => {
    if (onReload) {
      form.setFieldsValue(formValues)
      setOnReload(false)
    }
  }, [onReload])

  // For Editing to check whether the values have changed (prevent unnecessary API calls)
  const [formValues, setFormValues] =
    useState<OrganizationChatbotSettingsDefaults>({})

  const haveSettingsChanged = useMemo(() => {
    return organizationSettings !== undefined
      ? Object.keys(formValues)
          .map(
            (k) =>
              formValues[k as keyof OrganizationChatbotSettingsDefaults] !=
              organizationSettings[k as keyof OrganizationChatbotSettings],
          )
          .reduce((p, c) => p || c, false) ||
          defaultProvider != organizationSettings.defaultProvider?.id
      : false
  }, [formValues, organizationSettings, defaultProvider])

  const handleCreate = () => {
    if (isLoading || isDeleteProviderLoading) return
    if (createProviders.length == 0) {
      message.error(
        'At least one provider is required to create chatbot settings',
      )
      return
    }

    setIsLoading(true)
    form
      .validateFields()
      .then((values) => {
        API.chatbot.adminOnly
          .createOrganizationSettings(organizationId, {
            ...values,
            defaultProvider,
            providers: createProviders,
          })
          .then((settings) => {
            message.success(
              `Successfully created organization chatbot settings!`,
            )
            console.log(settings)
            if (setSettings) setSettings(settings)
          })
          .catch((err) => {
            message.error(getErrorMessage(err))
          })
      })
      .catch(() => {
        message.error('Invalid parameters')
      })
      .finally(() => setIsLoading(false))
  }

  const handleUpdate = () => {
    form
      .validateFields()
      .then((values) => {
        API.chatbot.adminOnly
          .updateOrganizationSettings(organizationId, {
            ...values,
            defaultProvider,
          })
          .then((settings) => {
            message.success(
              'Successfully updated organization chatbot settings!',
            )
            if (setSettings) setSettings(settings)
          })
          .catch((err) => {
            message.error(getErrorMessage(err))
          })
      })
      .catch(() => {
        message.error('Invalid parameters')
      })
      .finally(() => setIsLoading(false))
  }

  const handleAddCreateProvider = async (
    provider: CreateChatbotProviderBody,
  ) => {
    if (isLoading || isDeleteProviderLoading) return
    setIsCreatingCreateProvider(false)
    setCreateProviders((prev) => [...prev, provider])
    setOnReload(true)
  }

  const handleEditCreateProvider = async (
    provider: CreateChatbotProviderBody,
  ) => {
    if (isLoading || isDeleteProviderLoading) return
    if (editingCreateProvider == undefined) return
    setCreateProviders((prev) => [
      ...prev.slice(0, editingCreateProvider.index),
      provider,
      ...prev.slice(editingCreateProvider.index + 1),
    ])
    setOnReload(true)
  }

  const handleDeleteProvider = (provider: ChatbotProvider) => {
    if (isLoading || isDeleteProviderLoading) return
    if (organizationSettings == undefined) {
      message.error(
        'Organization chatbot settings does not exist, provider cannot be deleted as it cannot exist yet',
      )
      return
    }
    if (
      organizationSettings.defaultProvider == provider ||
      organizationSettings.providers.length == 1
    ) {
      message.error(
        'Cannot delete default provider for organization chatbot settings',
      )
      return
    }
    setIsDeleteProviderLoading(true)
    API.chatbot.adminOnly
      .deleteChatbotProvider(organizationId, provider.id)
      .then(() => {
        message.success('Successfully deleted chatbot provider!')
        if (setSettings) {
          setSettings({
            ...organizationSettings,
            providers: organizationSettings.providers.filter(
              (p) => p.id != provider.id,
            ),
          })
        }
      })
      .catch((err) => {
        message.error(
          `Error occurred while deleting chatbot provider: ${getErrorMessage(err)}`,
        )
      })
      .finally(() => setIsDeleteProviderLoading(false))
  }

  const handleResetFieldsValues = () => {
    const keyValueSet: OrganizationChatbotSettingsDefaults = {}
    if (organizationSettings != undefined) {
      Object.keys(organizationSettings)
        .filter((k) => k.startsWith('default_'))
        .forEach(
          (k) =>
            (keyValueSet[k as keyof OrganizationChatbotSettingsDefaults] =
              organizationSettings[
                k as keyof OrganizationChatbotSettings
              ] as any),
        )
      keyValueSet.defaultProvider = organizationSettings.defaultProvider.id
    } else {
      Object.keys(new OrganizationChatbotSettingsDefaults())
        .filter((k) => k.startsWith('default_'))
        .forEach(
          (k) =>
            (keyValueSet[k as keyof OrganizationChatbotSettingsDefaults] =
              undefined),
        )
    }
    form.setFieldsValue(keyValueSet)
    setFormValues(keyValueSet)
  }

  const clearFormValue = (key: string) => {
    const formKey = key as keyof OrganizationChatbotSettingsDefaults
    form.resetFields([formKey])
    form.setFieldsValue({
      [formKey]: null,
    })
    setFormValues((prev) => ({ ...prev, [formKey]: null }))
  }

  if (organizationSettings == undefined) {
    if (isCreatingCreateProvider) {
      return (
        <UpsertChatbotProvider
          organizationId={organizationId}
          canSelfSubmit={false}
          onSubmit={handleAddCreateProvider}
          onClose={() => {
            setIsCreatingCreateProvider(false)
          }}
        />
      )
    }
    if (editingCreateProvider != undefined) {
      return (
        <UpsertChatbotProvider
          organizationId={organizationId}
          canSelfSubmit={false}
          onSubmit={(provider: CreateChatbotProviderBody) =>
            handleEditCreateProvider(provider)
          }
          props={editingCreateProvider?.props}
          onClose={() => {
            setEditingCreateProvider(undefined)
          }}
        />
      )
    }
  } else {
    if (creatingProvider) {
      return (
        <UpsertChatbotProvider
          organizationId={organizationId}
          canSelfSubmit={true}
          setProvider={(provider) => {
            if (setSettings) {
              const settings = { ...organizationSettings }
              const providers = settings.providers
              settings.providers = [...providers, provider]
              setSettings(settings)
            }
          }}
          onSubmit={() => undefined}
          onClose={() => {
            setCreatingProvider(false)
            setOnReload(true)
          }}
        />
      )
    }
    if (editingProvider != undefined) {
      return (
        <UpsertChatbotProvider
          organizationId={organizationId}
          canSelfSubmit={true}
          setProvider={(provider) => {
            if (setSettings) {
              const settings = { ...organizationSettings }
              const providers = settings.providers
              const indexOf = providers.findIndex((p) => p.id == provider.id)
              if (provider.id == settings.defaultProvider.id) {
                settings.defaultProvider = provider
              }
              if (indexOf != -1) {
                settings.providers = [
                  ...providers.slice(0, indexOf),
                  provider,
                  ...providers.slice(indexOf + 1),
                ]
              } else {
                settings.providers = [...providers, provider]
              }
              setSettings(settings)
            }
          }}
          provider={editingProvider}
          onSubmit={() => undefined}
          onClose={() => {
            setEditingProvider(undefined)
            setOnReload(true)
          }}
        />
      )
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <Card classNames={{ header: 'hidden' }}>
        <Form
          form={form}
          labelWrap
          labelAlign="left"
          labelCol={{ flex: '25%' }}
          initialValues={{
            ...{ ...organizationSettings, defaultProvider: undefined },
            ...formValues,
          }}
          onValuesChange={(changedValues, values) => {
            const overwriteValues: Partial<OrganizationChatbotSettingsDefaults> =
              {}
            Object.keys(changedValues)
              .filter((k) => k.startsWith('default_'))
              .forEach((key) => {
                const formKey = key as keyof OrganizationChatbotSettingsDefaults
                let newValue = changedValues[key]
                if (newValue.trim() == '') {
                  overwriteValues[formKey] = null as any
                  return
                }

                const propertyName = key.substring('default_'.length)
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
              ...values,
              ...overwriteValues,
            })
          }}
        >
          <Divider>
            <span className={'text-lg'}>Chatbot Default Settings</span>
          </Divider>
          <div className={'mb-4 mt-2 flex flex-col gap-2'}>
            <div className={'text-md flex flex-col gap-1'}>
              <p>
                These are the settings each course within the organization will
                have by default. Applies to existing course settings that
                haven&#39;t already been overwritten.
              </p>
              <p>
                Courses that have their chatbot settings reset will take on
                these in place of the regular constant default values.
              </p>
              <p>
                Newly created courses will take on these values or the regular
                constant default values, if these defaults are not set.
              </p>
            </div>
            {organizationSettings == undefined && (
              <p className={'font-semibold'}>
                Upon creation of organization chatbot settings, these will apply
                to all courses.
              </p>
            )}
          </div>

          <div className={'flex flex-col gap-2'}>
            <Form.Item
              name="default_prompt"
              label={
                <Tooltip title="Set the prompt that is attached with any chatbot question. This will apply to all courses if not modified.">
                  Default Prompt <InfoCircleOutlined />
                </Tooltip>
              }
              shouldUpdate={(prevValues, nextValues) =>
                prevValues !== nextValues
              }
            >
              <div className="flex flex-col items-end gap-2">
                <Input.TextArea
                  value={formValues['default_prompt'] as any}
                  className={'w-full'}
                  rows={6}
                  placeholder={'e.g., You are a course assistant.'}
                />
                <ClearInputSuffix
                  formKey="default_prompt"
                  formValues={formValues}
                  clearFormValue={clearFormValue}
                />
              </div>
            </Form.Item>

            <Form.Item
              name="default_temperature"
              shouldUpdate={(prevValues, nextValues) =>
                prevValues !== nextValues
              }
              label={
                <Tooltip title="Adjust the temperature to control the randomness of the generation. Lower values make responses more predictable. Only applies for some models.">
                  Default Temperature <InfoCircleOutlined />
                </Tooltip>
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
                  value={formValues['default_temperature'] as any}
                  className={'w-full'}
                  placeholder={'A number from 0 to 1, e.g., 0.7'}
                />
                <ClearInputSuffix
                  formKey="default_temperature"
                  formValues={formValues}
                  clearFormValue={clearFormValue}
                />
              </div>
            </Form.Item>

            <Form.Item
              name="default_topK"
              shouldUpdate={(prevValues, nextValues) =>
                prevValues !== nextValues
              }
              label={
                <Tooltip title="This number determines the maximum number of text chunks the chatbot can retrieve and cite per question. Consider increasing it if the questions for your course generally require more chunks of context to answer properly.">
                  Default Top-K Documents <InfoCircleOutlined />
                </Tooltip>
              }
              rules={[
                {
                  type: 'number',
                  required: false,
                  min: 1,
                  message:
                    'If Top-K is defined, it must cause at least 1 document to be retrieved.',
                },
              ]}
            >
              <div className="flex flex-row gap-2">
                <InputNumber
                  value={formValues['default_topK'] as any}
                  className={'w-full'}
                  placeholder={'An integer, e.g., 5'}
                />
                <ClearInputSuffix
                  formKey="default_topK"
                  formValues={formValues}
                  clearFormValue={clearFormValue}
                />
              </div>
            </Form.Item>

            <Form.Item
              name="default_similarityThresholdDocuments"
              shouldUpdate={(prevValues, nextValues) =>
                prevValues !== nextValues
              }
              label={
                <Tooltip title="Set the minimum similarity threshold when retrieving relevant information blocks. You can increase this if you notice that the chatbot is retrieving irrelevant documents, or decrease it if it's not grabbing the chunks that it should have. In general, this threshold should be left default or at a low value so the AI has more information to work with, rather than too little.">
                  Default Similarity Threshold for Documents{' '}
                  <InfoCircleOutlined />
                </Tooltip>
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
                  value={
                    formValues['default_similarityThresholdDocuments'] as any
                  }
                  className={'w-full'}
                  placeholder={'A number from 0 to 1, e.g., 0.55'}
                />
                <ClearInputSuffix
                  formKey="default_similarityThresholdDocuments"
                  formValues={formValues}
                  clearFormValue={clearFormValue}
                />
              </div>
            </Form.Item>
          </div>
        </Form>
      </Card>
      <Card classNames={{ header: 'hidden' }}>
        <Divider>
          <span className={'text-lg'}>Chatbot Service Providers</span>
        </Divider>
        <div className={'text-md mb-4 flex flex-col gap-1'}>
          <p>
            These are the service providers you want to be available to all the
            courses in your organization. You can create several providers, or
            just one.
          </p>
          <p>
            If you are using Ollama, for instance, you can define multiple ways
            to connect to Ollama, in case some of your models are hosted
            elsewhere.
          </p>
        </div>
        <List<CreateChatbotProviderBody | ChatbotProvider>
          locale={{
            emptyText: (
              <div
                className={
                  'flex flex-col items-center justify-center gap-1 text-gray-400'
                }
              >
                <FrownOutlined />
                <p>No providers yet.</p>
                <p>
                  Create a provider configuration by clicking &#39;Add
                  Provider&#39; below.
                </p>
              </div>
            ),
          }}
          dataSource={
            organizationSettings != undefined
              ? organizationSettings.providers
              : createProviders
          }
          footer={
            <div className={'flex justify-end'}>
              <Button
                disabled={isLoading || isDeleteProviderLoading}
                icon={<PlusOutlined />}
                onClick={() => {
                  if (organizationSettings != undefined) {
                    setCreatingProvider(true)
                  } else {
                    setIsCreatingCreateProvider(true)
                  }
                }}
              >
                Create Provider
              </Button>
            </div>
          }
          renderItem={(
            providerProps: CreateChatbotProviderBody | ChatbotProvider,
            providerIndex: number,
          ) => {
            const asCreate = providerProps as CreateChatbotProviderBody
            const asProvider = providerProps as ChatbotProvider
            const isDefaultProvider =
              organizationSettings != undefined
                ? defaultProvider == asProvider.id
                : defaultProvider == providerIndex
            return (
              <Card
                className={cn(
                  isDefaultProvider
                    ? 'border-helpmeblue-light'
                    : 'border-gray-200',
                  'mb-2 border-2 border-solid',
                )}
                title={
                  providerProps.nickname ?? `Provider ${providerIndex + 1}`
                }
                extra={
                  <span>
                    <Tooltip
                      title={
                        !isDefaultProvider
                          ? 'Click to set as default provider'
                          : 'This is the default provider'
                      }
                    >
                      <button
                        onClick={() =>
                          setDefaultProvider(
                            organizationSettings != undefined
                              ? asProvider.id
                              : providerIndex,
                          )
                        }
                        className={cn(
                          !isDefaultProvider
                            ? 'hover:cursor-pointer'
                            : 'hover:cursor-default',
                          'flex items-center justify-center text-xl',
                        )}
                      >
                        {isDefaultProvider ? (
                          <StarFilled className={'text-helpmeblue'} />
                        ) : (
                          <StarOutlined
                            className={'hover:text-helpmeblue text-gray-500'}
                          />
                        )}
                      </button>
                    </Tooltip>
                  </span>
                }
              >
                <div className={'flex flex-col gap-2'}>
                  <div className={'flex w-full gap-2'}>
                    <div className={'w-full'}>
                      <Statistic
                        title={'Provider Type'}
                        value={Object.keys(ChatbotServiceProvider).find(
                          (k) =>
                            (ChatbotServiceProvider as Record<string, string>)[
                              k
                            ] == providerProps.providerType,
                        )}
                      />
                    </div>
                    {providerProps.baseUrl && (
                      <div className={'w-full'}>
                        <Statistic
                          title={'Base URL'}
                          value={providerProps.baseUrl}
                        />
                      </div>
                    )}
                  </div>
                  <Collapse
                    defaultActiveKey={undefined}
                    bordered={false}
                    items={[
                      {
                        key: 1,
                        label: (
                          <div className={'ant-form-item-label'}>
                            <label className={'w-full'}>
                              <div className={'flex'}>
                                <Tooltip title="Set additional notes for this provider. These will appear in model selection for all models of this provider.">
                                  Additional Notes <InfoCircleOutlined />
                                </Tooltip>
                              </div>
                            </label>
                          </div>
                        ),
                        children: (
                          <div className={'flex flex-col'}>
                            <AdditionalNotesList
                              notes={providerProps.additionalNotes ?? []}
                              bordered={false}
                            />
                          </div>
                        ),
                      },
                    ]}
                  />
                  <div
                    className={cn(
                      providerProps.providerType ==
                        ChatbotServiceProvider.OpenAI
                        ? 'grid-cols-1'
                        : 'grid-cols-2',
                      'grid gap-2',
                    )}
                  >
                    <Card
                      title={'Models'}
                      variant={'borderless'}
                      className={'border-2 border-solid border-gray-200'}
                      classNames={{ header: 'text-center', body: 'p-2' }}
                    >
                      <List<LLMType | CreateLLMTypeBody>
                        dataSource={
                          organizationSettings != undefined
                            ? asProvider.availableModels
                            : asCreate.models
                        }
                        renderItem={(model) => {
                          const asCreateLLM = model as CreateLLMTypeBody
                          const asLLM = model as LLMType
                          const { speed, quality } =
                            getModelSpeedAndQualityEstimate(asLLM)
                          return (
                            <Tooltip
                              title={
                                model.isText && (
                                  <ChatbotModelInfoTooltip
                                    speed={speed}
                                    quality={quality}
                                    additionalNotes={[]}
                                  />
                                )
                              }
                            >
                              <div
                                className={
                                  'my-2 box-border h-fit w-full rounded-md border-2 border-gray-200 p-2 shadow-md'
                                }
                              >
                                <LLMTypeDisplay
                                  model={model}
                                  isDefault={
                                    organizationSettings != undefined
                                      ? asProvider.defaultModel.id == asLLM.id
                                      : asCreate.defaultModelName ==
                                        asCreateLLM.modelName
                                  }
                                  isDefaultVision={
                                    organizationSettings != undefined
                                      ? asProvider.defaultVisionModel.id ==
                                        asLLM.id
                                      : asCreate.defaultVisionModelName ==
                                        asCreateLLM.modelName
                                  }
                                  showNotes={
                                    (model.additionalNotes?.length ?? 0) > 0
                                  }
                                  shortenButtons={true}
                                />
                              </div>
                            </Tooltip>
                          )
                        }}
                      />
                    </Card>
                    {providerProps.providerType !=
                      ChatbotServiceProvider.OpenAI && (
                      <Card
                        title={'Headers'}
                        variant={'borderless'}
                        className={'border-2 border-solid border-gray-200'}
                        classNames={{ header: 'text-center', body: 'p-2' }}
                      >
                        <Table
                          className={'p-0'}
                          locale={{
                            emptyText: 'No headers defined',
                          }}
                          dataSource={
                            providerProps.headers
                              ? Object.keys(providerProps.headers).map((h) => ({
                                  key: h,
                                  value:
                                    providerProps.headers![
                                      h as keyof ChatbotAllowedHeaders
                                    ],
                                }))
                              : []
                          }
                        >
                          <Table.Column dataIndex={'key'} title={'Header'} />
                          <Table.Column dataIndex={'value'} title={'Value'} />
                        </Table>
                      </Card>
                    )}
                  </div>
                  <div className={'flex justify-end gap-2'}>
                    <Button
                      disabled={isLoading || isDeleteProviderLoading}
                      icon={<EditOutlined />}
                      onClick={() => {
                        if (organizationSettings != undefined) {
                          setEditingProvider(asProvider)
                        } else {
                          setEditingCreateProvider({
                            props: asCreate,
                            index: providerIndex,
                          })
                        }
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      disabled={isLoading}
                      loading={isDeleteProviderLoading}
                      icon={<DeleteOutlined />}
                      danger
                      onClick={() => {
                        if (organizationSettings != undefined) {
                          handleDeleteProvider(asProvider)
                        } else {
                          setCreateProviders((prev) =>
                            prev.filter((_, i) => i != providerIndex),
                          )
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            )
          }}
        />
      </Card>
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
            {organizationSettings == undefined ? (
              <Button
                loading={isLoading}
                type={'primary'}
                onClick={handleCreate}
              >
                Create
              </Button>
            ) : (
              <>
                <Tooltip
                  title={
                    !haveSettingsChanged ? 'No changes detected.' : undefined
                  }
                >
                  <Button
                    loading={isLoading}
                    disabled={!haveSettingsChanged}
                    onClick={handleResetFieldsValues}
                  >
                    Reset Changes
                  </Button>
                </Tooltip>
                <Tooltip
                  title={
                    !haveSettingsChanged ? 'No changes detected.' : undefined
                  }
                >
                  <Button
                    loading={isLoading}
                    disabled={!haveSettingsChanged || isDeleteProviderLoading}
                    type={'primary'}
                    onClick={handleUpdate}
                  >
                    Save Changes
                  </Button>
                </Tooltip>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

export default OrganizationChatbotSettingsForm

type ClearInputSuffixProps = {
  formKey: string
  formValues: Record<string, any>
  defaultValues?: Record<string, any>
  clearFormValue: (key: string) => void
  icon?: React.ReactNode
}

export const ClearInputSuffix: React.FC<ClearInputSuffixProps> = ({
  formKey,
  formValues,
  defaultValues,
  clearFormValue,
  icon,
}) => {
  const formValue = formValues[formKey]
  const defaultValue =
    defaultValues != undefined ? defaultValues[formKey] : undefined
  if (
    formValue === null ||
    formValue === undefined ||
    (defaultValue != undefined && formValue == defaultValue)
  )
    return null
  return (
    <Button
      danger
      icon={icon ?? <DeleteOutlined />}
      onClick={() => clearFormValue(formKey)}
    />
  )
}
