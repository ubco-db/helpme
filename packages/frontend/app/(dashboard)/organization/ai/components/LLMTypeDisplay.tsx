import { Tooltip } from 'antd'
import {
  EyeOutlined,
  FontSizeOutlined,
  MessageOutlined,
} from '@ant-design/icons'
import { cn } from '@/app/utils/generalUtils'

type LLMTypeDisplayProps = {
  model: {
    modelName: string
    isText: boolean
    isVision: boolean
    isThinking: boolean
  }
  isDefault?: boolean
  isDefaultVision?: boolean
  setDefault?: (modelName: string, vision?: boolean) => void
}

const LLMTypeDisplay: React.FC<LLMTypeDisplayProps> = ({
  model,
  isDefault,
  isDefaultVision,
  setDefault,
}) => {
  return (
    <div className={'flex w-full items-center justify-between gap-2'}>
      <span>{model.modelName}</span>
      <div
        className={
          'flex flex-row items-center justify-center gap-1 p-2 text-lg'
        }
      >
        {model.isText && (
          <LLMModeDisplay
            icon={<FontSizeOutlined />}
            title={`This model can process text input.${isDefault ? ' This is the default text model for this provider.' : ''}`}
            canSetActive={setDefault != undefined}
            active={isDefault}
            toggleActive={() => setDefault && setDefault(model.modelName)}
          />
        )}
        {model.isVision && (
          <LLMModeDisplay
            icon={<EyeOutlined />}
            title={`This model can process visual inputs.${isDefaultVision ? ' This is the default vision model for this provider.' : ''}`}
            canSetActive={setDefault != undefined}
            active={isDefaultVision}
            toggleActive={() => setDefault && setDefault(model.modelName, true)}
          />
        )}
        {model.isThinking && (
          <LLMModeDisplay
            icon={<MessageOutlined />}
            title={
              "This model attempts to give better responses by 'thinking'. It will probably take longer to respond to questions."
            }
            canSetActive={false}
          />
        )}
      </div>
    </div>
  )
}

export default LLMTypeDisplay

type LLMModeDisplayProps = {
  icon: React.ReactNode
  title: string
  canSetActive?: boolean
  active?: boolean
  toggleActive?: () => void
}

const LLMModeDisplay: React.FC<LLMModeDisplayProps> = ({
  icon,
  title,
  canSetActive,
  active,
  toggleActive,
}) => {
  return (
    <Tooltip title={title}>
      <button
        className={cn(
          canSetActive ? 'hover:cursor-pointer' : 'hover:cursor-default',
          canSetActive && active
            ? 'text-helpmeblue hover:text-helpmeblue-light'
            : canSetActive && !active
              ? 'text-gray-500 hover:text-gray-300'
              : '',
          active ? 'text-helpmeblue' : 'text-gray-500',
          'm-0 flex items-center justify-center border-none bg-transparent p-0',
        )}
        onClick={() =>
          canSetActive && toggleActive != undefined && toggleActive()
        }
      >
        {icon}
      </button>
    </Tooltip>
  )
}
