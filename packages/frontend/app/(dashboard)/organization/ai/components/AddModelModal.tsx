import { useEffect, useMemo, useState } from 'react'
import {
  ChatbotAllowedHeaders,
  ChatbotServiceProvider,
  LLMType,
} from '@koh/common'
import { API } from '@/app/api'
import { Button, Divider, List, message, Modal, Tooltip } from 'antd'
import ChatbotModelInfoTooltip from '@/app/(dashboard)/components/ChatbotModelInfoTooltip'
import { FrownOutlined, PlusOutlined } from '@ant-design/icons'
import LLMTypeDisplay from '@/app/(dashboard)/organization/ai/components/LLMTypeDisplay'
import { getModelSpeedAndQualityEstimate } from '@/app/utils/generalUtils'

type AddModelModalProps<T extends LLMType> = {
  organizationId: number
  providerType: ChatbotServiceProvider
  baseUrl?: string
  apiKey?: string
  headers?: ChatbotAllowedHeaders
  providerId?: number
  fetchedAvailableModels?: T[]
  inUseModels: T[]
  onAdd: (type: LLMType) => void
  open: boolean
  onClose: () => void
}

const AddModelModal = <T extends LLMType>({
  organizationId,
  providerType,
  baseUrl,
  apiKey,
  headers,
  providerId,
  fetchedAvailableModels,
  inUseModels,
  onAdd,
  open,
  onClose,
}: AddModelModalProps<T>) => {
  const [isLoading, setIsLoading] = useState(false)
  const [availableModels, setAvailableModels] = useState<T[]>(
    fetchedAvailableModels ?? [],
  )

  const providerTypeName = useMemo(
    () =>
      Object.keys(ChatbotServiceProvider).find(
        (k) =>
          (ChatbotServiceProvider as Record<string, string>)[k] == providerType,
      ) ?? '',
    [providerType],
  )

  const fetchAvailableModels = (calledFromRetry = false) => {
    if (fetchedAvailableModels != undefined || isLoading) {
      return
    }

    if (
      providerType == ChatbotServiceProvider.Ollama &&
      (baseUrl == undefined || baseUrl == '')
    ) {
      if (calledFromRetry) {
        message.error(
          `Missing base URL property that is required to retrieve models for ${providerTypeName}.`,
        )
      }
      return
    } else if (
      providerType == ChatbotServiceProvider.OpenAI &&
      (apiKey == undefined || apiKey == '')
    ) {
      if (calledFromRetry) {
        message.error(
          `Missing API key property that is required to retrieve models for ${providerTypeName}.`,
        )
      }
      return
    }

    setIsLoading(true)
    setAvailableModels([])
    if (providerId != undefined) {
      API.chatbot.adminOnly
        .getProviderAvailableModels<T>(organizationId, providerId)
        .then((response) => {
          setAvailableModels(response)
        })
        .catch(() => {
          if (calledFromRetry) {
            message.error(
              `Failed to retrieve provider's model list from ${providerTypeName} service`,
            )
          }
        })
        .finally(() => setIsLoading(false))
    } else {
      API.chatbot.adminOnly
        .getAvailableModels<T>(providerType, organizationId, {
          baseUrl: baseUrl,
          apiKey: apiKey,
          headers: headers ?? {},
        })
        .then((response) => {
          setAvailableModels(response)
        })
        .catch(() => {
          if (calledFromRetry) {
            message.error(
              `Failed to retrieve model list from ${providerTypeName} service`,
            )
          }
        })
        .finally(() => setIsLoading(false))
    }
  }

  useEffect(() => {
    fetchAvailableModels()
  }, [baseUrl, apiKey, headers, providerId])

  const groupedModels: { group: string; models: T[] }[] = useMemo(() => {
    const groups = (
      availableModels as unknown as (T & { families: string[] })[]
    )
      .map((m) => m.families)
      .reduce((p, c) => [...p, ...c], [])
      .filter((v, i, a) => a.indexOf(v) == i)

    const alreadyGrouped: T[] = []
    return groups.map((grp) => {
      const belongsTo = availableModels.filter(
        (m) =>
          (m as T & { families: string[] }).families.includes(grp) &&
          !alreadyGrouped.includes(m),
      )
      alreadyGrouped.push(...belongsTo)
      return { group: grp, models: belongsTo }
    })
  }, [availableModels])

  return (
    <Modal
      centered
      title={'Add Models'}
      open={open}
      onCancel={onClose}
      cancelButtonProps={{ hidden: true }}
      okButtonProps={{ hidden: true }}
    >
      <List<{ group: string; models: T[] }>
        locale={{
          emptyText: (
            <div
              className={
                'flex flex-col items-center justify-center gap-1 text-gray-400'
              }
            >
              <FrownOutlined />
              <p>Failed to get list of available {providerTypeName} models.</p>
              <p>
                You may want to check your URL to see if it is valid, or add any
                authorization headers necessary.
              </p>
              <Button
                onClick={() => fetchAvailableModels(true)}
                loading={isLoading}
              >
                Retry?
              </Button>
            </div>
          ),
        }}
        className={'max-h-80 w-full overflow-y-auto overflow-x-hidden p-2'}
        loading={isLoading}
        dataSource={groupedModels}
        renderItem={(groupModels: { group: string; models: T[] }) => (
          <List.Item key={`${groupModels.group}-group`}>
            <div className={'flex w-full flex-col gap-1'}>
              <Divider>{groupModels.group}</Divider>
              <List<T>
                dataSource={groupModels.models}
                renderItem={(model: T) => {
                  const { speed, quality, notes } =
                    getModelSpeedAndQualityEstimate(model)

                  return (
                    <List.Item
                      key={`${groupModels.group}-group-${model.modelName}`}
                    >
                      <div
                        className={'flex w-full flex-row justify-between gap-1'}
                      >
                        <Tooltip
                          arrow={false}
                          title={
                            <ChatbotModelInfoTooltip
                              speed={speed}
                              quality={quality}
                              additionalNotes={notes}
                            />
                          }
                        >
                          <div className={'h-fit w-full'}>
                            <LLMTypeDisplay model={model} />
                          </div>
                        </Tooltip>
                        <Button
                          onClick={() => onAdd(model)}
                          disabled={inUseModels.some(
                            (m) => m.modelName == model.modelName,
                          )}
                        >
                          {inUseModels.some(
                            (m) => m.modelName == model.modelName,
                          ) ? (
                            <>Added</>
                          ) : (
                            <>
                              <PlusOutlined /> Add
                            </>
                          )}
                        </Button>
                      </div>
                    </List.Item>
                  )
                }}
              />
            </div>
          </List.Item>
        )}
      />
    </Modal>
  )
}

export default AddModelModal
