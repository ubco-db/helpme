import { Button, Checkbox, Collapse, Input, List, message, Tooltip } from 'antd'
import {
  CheckOutlined,
  CloseOutlined,
  EditOutlined,
  EyeOutlined,
  FontSizeOutlined,
  InfoCircleOutlined,
  MessageOutlined,
  PlusOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons'
import { cn } from '@/app/utils/generalUtils'
import { useEffect, useMemo, useState } from 'react'
import AdditionalNotesList from '@/app/(dashboard)/organization/ai/components/AdditionalNotesList'

type LLMTypeDisplayProps = {
  model: {
    id?: number
    modelName: string
    isRecommended: boolean
    isText: boolean
    isVision: boolean
    isThinking: boolean
    additionalNotes?: string[]
  }

  isDefault?: boolean
  isDefaultVision?: boolean
  setDefault?: (modelName: string, vision?: boolean) => void

  showNotes?: boolean
  allowNoteEditing?: boolean
  onUpdateNotes?: (modelName: string, notes: string[]) => void
  shortenButtons?: boolean

  allowRecommendedEdit?: boolean
  onUpdateRecommended?: (modelName: string, isRecommended: boolean) => void
}

const LLMTypeDisplay: React.FC<LLMTypeDisplayProps> = ({
  model,
  isDefault,
  isDefaultVision,
  setDefault,
  showNotes,
  allowNoteEditing,
  onUpdateNotes,
  shortenButtons,
  allowRecommendedEdit,
  onUpdateRecommended,
}) => {
  const [isRecommended, setIsRecommended] = useState<boolean>(
    model.isRecommended,
  )
  const [notes, setNotes] = useState<string[]>(model.additionalNotes ?? [])

  useEffect(() => {
    if (
      onUpdateNotes &&
      JSON.stringify(model.additionalNotes) !== JSON.stringify(notes)
    ) {
      onUpdateNotes(model.modelName, notes)
    }
    if (onUpdateRecommended) {
      onUpdateRecommended(model.modelName, isRecommended)
    }
  }, [isRecommended, notes])

  return (
    <div className={'flex w-full flex-col gap-2'}>
      <div className={'flex w-full items-center justify-between gap-2'}>
        <span>
          {model.modelName}{' '}
          {model.isRecommended && !allowRecommendedEdit && (
            <span className={'text-gray-500'}>(Recommended)</span>
          )}
        </span>
        {allowRecommendedEdit && model.isText && (
          <Checkbox
            checked={isRecommended}
            onChange={() => setIsRecommended(!isRecommended)}
          >
            Recommended?
          </Checkbox>
        )}
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
              toggleActive={() =>
                setDefault && setDefault(model.modelName, true)
              }
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
      {showNotes && (
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
                      <Tooltip title="Set additional notes for this model. These will appear in model selection for this model.">
                        Additional Notes <InfoCircleOutlined />
                      </Tooltip>
                    </div>
                  </label>
                </div>
              ),
              children: (
                <div className={'flex flex-col text-xs'}>
                  <AdditionalNotesList
                    notes={notes}
                    setNotes={setNotes}
                    initialNotes={model?.additionalNotes}
                    allowNoteEditing={allowNoteEditing}
                    shortenButtons={shortenButtons}
                    bordered={true}
                  />
                </div>
              ),
            },
          ]}
        />
      )}
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
