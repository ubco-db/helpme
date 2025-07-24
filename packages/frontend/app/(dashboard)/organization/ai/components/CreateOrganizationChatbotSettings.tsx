import { API } from '@/app/api'
import {
  ChatbotAllowedHeaders,
  ChatbotServiceProvider,
  CreateChatbotProviderBody,
  CreateOrganizationChatbotSettingsBody,
  OrganizationChatbotSettings,
} from '@koh/common'
import {
  Button,
  Card,
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
import { useState } from 'react'
import {
  DeleteOutlined,
  EditOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons'
import UpsertChatbotProvider from '@/app/(dashboard)/organization/ai/components/UpsertChatbotProvider'
import LLMTypeDisplay from '@/app/(dashboard)/organization/ai/components/LLMTypeDisplay'
import { cn, getErrorMessage } from '@/app/utils/generalUtils'

type CreateOrganizationChatbotSettingsProps = {
  organizationId: number
  setSettings?: (settings: OrganizationChatbotSettings) => void
}

const CreateOrganizationChatbotSettings: React.FC<
  CreateOrganizationChatbotSettingsProps
> = ({ organizationId, setSettings }) => {
  const [form] = Form.useForm<Partial<CreateOrganizationChatbotSettingsBody>>()
  const [createProviders, setCreateProviders] = useState<
    CreateChatbotProviderBody[]
  >([])
  const [editingCreateProvider, setEditingCreateProvider] = useState<
    { props: CreateChatbotProviderBody; index: number } | undefined
  >()
  const [isCreatingProvider, setIsCreatingProvider] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const [defaultProvider, setDefaultProvider] = useState<number>(0)

  const handleCreate = () => {
    if (isLoading) return
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
              'Successfully created organization chatbot settings!',
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
    setIsCreatingProvider(false)
    setCreateProviders((prev) => [...prev, provider])
  }

  const handleEditCreateProvider = async (
    provider: CreateChatbotProviderBody,
  ) => {
    if (editingCreateProvider == undefined) return
    setCreateProviders((prev) => [
      ...prev.slice(0, editingCreateProvider.index),
      provider,
      ...prev.slice(editingCreateProvider.index + 1),
    ])
  }

  if (isCreatingProvider) {
    return (
      <UpsertChatbotProvider
        organizationId={organizationId}
        canSelfSubmit={false}
        onSubmit={handleAddCreateProvider}
        onClose={() => setIsCreatingProvider(false)}
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

  return (
    <Card title={'Create Organization Chatbot Settings'}>
      <Form form={form}>
        <Divider>
          <span className={'text-lg'}>Chatbot Default Settings</span>
        </Divider>
        <p className={'my-1'}>
          These are the settings each course within the organization will have
          by default. Does not apply retroactively. If migrating from legacy
          chatbot interactions, will apply to all existing courses.
        </p>

        <div className={'flex flex-col gap-2'}>
          <Form.Item
            name="default_prompt"
            label={
              <Tooltip title="Set the prompt that is attached with any chatbot question. This will apply to all courses if not modified.">
                Default Prompt <InfoCircleOutlined />
              </Tooltip>
            }
          >
            <Input.TextArea rows={6} />
          </Form.Item>

          <Form.Item
            name="default_temperature"
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
            <InputNumber />
          </Form.Item>

          <Form.Item
            name="default_topK"
            label={
              <Tooltip title="This number determines the maximum number of text chunks the chatbot can retrieve and cite per question. Consider increasing it if the questions for your course generally require more chunks of context to answer properly.">
                Default Top-K Documents <InfoCircleOutlined />
              </Tooltip>
            }
            rules={[
              {
                required: false,
                min: 1,
                message:
                  'If Top-K is defined, it must cause at least 1 document to be retrieved.',
              },
            ]}
          >
            <InputNumber />
          </Form.Item>

          <Form.Item
            name="default_similarityThresholdDocuments"
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
          >
            <InputNumber />
          </Form.Item>
        </div>

        <Divider>
          <span className={'text-lg'}>Chatbot Service Providers</span>
        </Divider>
        <p className={'my-1'}>
          These are the service providers you want to be available to all the
          courses in your organization. You can create several providers, or
          just one. If you are using Ollama, for instance, you can define
          multiple ways to connect to Ollama, in case some of your models are
          hosted elsewhere.
        </p>

        <List
          dataSource={createProviders}
          footer={
            <div className={'flex justify-end'}>
              <Button
                disabled={isLoading}
                icon={<PlusOutlined />}
                onClick={() => setIsCreatingProvider(true)}
              >
                Create Provider
              </Button>
            </div>
          }
          renderItem={(
            providerProps: CreateChatbotProviderBody,
            providerIndex: number,
          ) => (
            <Card
              title={providerProps.nickname ?? `Provider ${providerIndex + 1}`}
              extra={
                <span>
                  <Tooltip
                    title={
                      defaultProvider != providerIndex
                        ? 'Click to set as default provider'
                        : 'This is the default provider'
                    }
                  >
                    <button
                      onClick={() => setDefaultProvider(providerIndex)}
                      className={cn(
                        defaultProvider != providerIndex
                          ? 'hover:cursor-pointer'
                          : 'hover:cursor-default',
                        'flex items-center justify-center text-xl',
                      )}
                    >
                      {defaultProvider == providerIndex && (
                        <StarFilled className={'text-helpmeblue'} />
                      )}
                      {defaultProvider != providerIndex && (
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
                <div className={'grid grid-cols-2 gap-2'}>
                  <Card
                    title={'Models'}
                    variant={'borderless'}
                    classNames={{ body: 'p-0' }}
                  >
                    <List
                      dataSource={providerProps.models}
                      renderItem={(model) => (
                        <LLMTypeDisplay
                          model={model}
                          isDefault={
                            providerProps.defaultModelName == model.modelName
                          }
                          isDefaultVision={
                            providerProps.defaultVisionModelName ==
                            model.modelName
                          }
                        />
                      )}
                    />
                  </Card>
                  <Card
                    title={'Headers'}
                    variant={'borderless'}
                    classNames={{ body: 'p-0' }}
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
                </div>
                <div className={'flex justify-end gap-2'}>
                  <Button
                    disabled={isLoading}
                    icon={<EditOutlined />}
                    onClick={() => {
                      setEditingCreateProvider({
                        props: providerProps,
                        index: providerIndex,
                      })
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    disabled={isLoading}
                    icon={<DeleteOutlined />}
                    danger
                    onClick={() => {
                      setCreateProviders((prev) =>
                        prev.filter((_, i) => i != providerIndex),
                      )
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          )}
        />

        <Divider />

        <div className={'flex justify-center'}>
          <Button loading={isLoading} type={'primary'} onClick={handleCreate}>
            Create Organization Chatbot Configuration
          </Button>
        </div>
      </Form>
    </Card>
  )
}

export default CreateOrganizationChatbotSettings
