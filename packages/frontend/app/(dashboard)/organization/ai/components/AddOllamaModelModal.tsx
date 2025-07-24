import { useEffect, useMemo, useState } from 'react'
import { ChatbotAllowedHeaders, LLMType, OllamaLLMType } from '@koh/common'
import { API } from '@/app/api'
import { Button, Divider, List, message, Modal, Tooltip } from 'antd'
import ChatbotModelInfoTooltip from '@/app/(dashboard)/components/ChatbotModelInfoTooltip'
import { FrownOutlined, PlusOutlined } from '@ant-design/icons'
import LLMTypeDisplay from '@/app/(dashboard)/organization/ai/components/LLMTypeDisplay'

type AddOllamaModelModalProps = {
  organizationId: number
  baseUrl?: string
  headers?: ChatbotAllowedHeaders
  providerId?: number
  fetchedAvailableModels?: OllamaLLMType[]
  inUseModels: LLMType[]
  onAdd: (type: LLMType) => void
  open: boolean
  onClose: () => void
}

const AddOllamaModelModal: React.FC<AddOllamaModelModalProps> = ({
  organizationId,
  baseUrl,
  headers,
  providerId,
  fetchedAvailableModels,
  inUseModels,
  onAdd,
  open,
  onClose,
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [availableModels, setAvailableModels] = useState<OllamaLLMType[]>(
    fetchedAvailableModels ?? [],
  )

  const fetchAvailableModels = async () => {
    if (fetchedAvailableModels != undefined) {
      return
    }

    if (baseUrl == undefined || baseUrl == '') return
    setAvailableModels([])
    if (providerId != undefined) {
      await API.chatbot.adminOnly
        .getProviderAvailableModels(organizationId, providerId)
        .then((response) => {
          setAvailableModels(response)
        })
        .catch((err) =>
          message.error(
            "Failed to retrieve provider's model list from Ollama service",
          ),
        )
    } else {
      await API.chatbot.adminOnly
        .getOllamaAvailableModels(organizationId, {
          baseUrl: baseUrl ?? '',
          headers: headers ?? {},
        })
        .then((response) => {
          setAvailableModels(response)
        })
        .catch(() =>
          message.error('Failed to retrieve model list from Ollama service'),
        )
    }
  }

  const fetchData = async () => {
    if (isLoading) return
    setIsLoading(true)
    await Promise.all([await fetchAvailableModels()]).finally(() =>
      setIsLoading(false),
    )
  }

  useEffect(() => {
    fetchData().then()
  }, [baseUrl, headers, providerId])

  const groupedModels: { group: string; models: OllamaLLMType[] }[] =
    useMemo(() => {
      const groups = availableModels
        .map((m) => m.families)
        .reduce((p, c) => [...p, ...c], [])
        .filter((v, i, a) => a.indexOf(v) == i)

      const alreadyGrouped: OllamaLLMType[] = []
      return groups.map((grp) => {
        const belongsTo = availableModels.filter(
          (m) => m.families.includes(grp) && !alreadyGrouped.includes(m),
        )
        alreadyGrouped.push(...belongsTo)
        return { group: grp, models: belongsTo }
      })
    }, [availableModels])

  return (
    <Modal
      title={'Add Models'}
      open={open}
      onCancel={onClose}
      cancelButtonProps={{ hidden: true }}
      okButtonProps={{ hidden: true }}
    >
      <List
        locale={{
          emptyText: (
            <div className={'flex flex-col items-center justify-center gap-1'}>
              <FrownOutlined />
              <p>Failed to get list of available Ollama models.</p>
              <p>
                You may want to check your URL to see if it is valid, or add any
                authorization headers necessary.
              </p>
              <Button onClick={() => fetchData()} loading={isLoading}>
                Retry?
              </Button>
            </div>
          ),
        }}
        className={'max-h-80 w-full overflow-y-auto overflow-x-hidden p-2'}
        loading={isLoading}
        dataSource={groupedModels}
        renderItem={(groupModels: {
          group: string
          models: OllamaLLMType[]
        }) => (
          <List.Item key={`${groupModels.group}-group`}>
            <div className={'flex w-full flex-col gap-1'}>
              <Divider>{groupModels.group}</Divider>
              <List
                dataSource={groupModels.models}
                renderItem={(model: OllamaLLMType) => {
                  const split = model.parameterSize.split(/[a-zA-Z]/)
                  const multiplier = (() => {
                    switch (split[1]) {
                      case 'M':
                        return 1
                      case 'B':
                        return 1000
                      case 'T':
                        return 1000000
                      default:
                        return 1
                    }
                  })()
                  const paramSize = Math.min(
                    parseFloat(split[0]) * multiplier,
                    1000000,
                  )

                  return (
                    <List.Item
                      key={`${groupModels.group}-group-${model.modelName}`}
                    >
                      <div
                        className={'flex w-full flex-row justify-between gap-1'}
                      >
                        <Tooltip
                          title={
                            <ChatbotModelInfoTooltip
                              speed={
                                1 -
                                (paramSize / 1000000) *
                                  (model.isThinking ? 0.5 : 0)
                              }
                              quality={Math.min(
                                1,
                                (paramSize / 1000000) *
                                  (model.isThinking ? 2 : 0),
                              )}
                              additionalNotes={[]}
                            />
                          }
                        >
                          <LLMTypeDisplay model={model} />
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

export default AddOllamaModelModal
