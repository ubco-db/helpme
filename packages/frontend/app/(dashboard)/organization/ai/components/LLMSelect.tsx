import { Select, Tooltip } from 'antd'
import { getModelSpeedAndQualityEstimate } from '@/app/utils/generalUtils'
import ChatbotModelInfoTooltip from '@/app/(dashboard)/components/ChatbotModelInfoTooltip'
import LLMTypeDisplay from '@/app/(dashboard)/organization/ai/components/LLMTypeDisplay'
import {
  ChatbotProvider,
  ChatbotServiceProvider,
  CourseChatbotSettings,
} from '@koh/common'

type LLMSelectProps = {
  providers: ChatbotProvider[]
}

const LLMSelect: React.FC<LLMSelectProps> = ({ providers }) => {
  return (
    <Select>
      {providers.map((provider: ChatbotProvider, index0) => (
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
                          additionalNotes={notes}
                        />
                      }
                    >
                      <LLMTypeDisplay
                        model={model}
                        isDefault={provider.defaultModel?.id == model.id}
                        isDefaultVision={provider.defaultModel?.id == model.id}
                      />
                    </Tooltip>
                  </div>
                </Select.Option>
              )
            })}
        </Select.OptGroup>
      ))}
    </Select>
  )
}

export default LLMSelect
