import { ReactElement, useState } from 'react'
import { Text } from './SharedComponents'
import { QuestionTypeParams } from '@koh/common'

//
// QUESTION TYPES
//
interface QuestionTypeProps {
  typeName: string
  typeColor: string
  onClick?: () => void
  className?: string
}
export function QuestionType({
  typeName,
  typeColor,
  onClick,
  className,
}: QuestionTypeProps): ReactElement {
  function getBrightness(color: string): number {
    const rgb = parseInt(color.slice(1), 16)
    const r = (rgb >> 16) & 0xff
    const g = (rgb >> 8) & 0xff
    const b = (rgb >> 0) & 0xff
    return (r * 299 + g * 587 + b * 114) / 1000
  }
  const textColor = !typeName
    ? 'red'
    : getBrightness(typeColor) < 128
      ? 'white'
      : 'black'

  return (
    <div
      style={{
        backgroundColor: typeColor,
        borderRadius: '15px',
        padding: '0px 7px',
        //marginTop: '2px',
        margin: '2px',
        display: 'inline-block',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
      className={className}
    >
      <Text style={{ fontSize: 'smaller', color: textColor }}>
        {typeName ?? 'error: missing tag text'}
      </Text>{' '}
    </div>
  )
}

//
// CHECKABLE (like checkbox) QUESTION TYPES
//

interface CheckableQuestionTypeProps {
  typeName: string
  typeColor: string
  typeID: number
  onChange: (typeID: number, checked: boolean) => void
  checked: boolean
}

export function CheckableQuestionType({
  typeName,
  typeColor,
  typeID,
  onChange,
  checked,
}: CheckableQuestionTypeProps): React.ReactElement {
  function getBrightness(color: string): number {
    const rgb = parseInt(color.slice(1), 16)
    const r = (rgb >> 16) & 0xff
    const g = (rgb >> 8) & 0xff
    const b = (rgb >> 0) & 0xff
    return (r * 299 + g * 587 + b * 114) / 1000
  }
  const textColor = checked
    ? getBrightness(typeColor) < 128
      ? 'white'
      : 'black'
    : 'gray'

  const handleClick = () => {
    onChange(typeID, !checked)
  }

  // for making it so you can press enter to toggle it
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleClick()
    }
  }

  // for applying hover and focus styles
  const [isHovered, setIsHovered] = useState(false)
  const handleMouseEnter = () => {
    setIsHovered(true)
  }
  const handleMouseLeave = () => {
    setIsHovered(false)
  }
  const handleFocus = () => {
    setIsHovered(true)
  }
  const handleBlur = () => {
    setIsHovered(false)
  }

  return (
    <div
      style={{
        backgroundColor: checked ? typeColor : undefined,
        borderRadius: '15px',
        padding: '0px 7px',
        margin: '2px',
        display: 'inline-block',
        cursor: 'pointer',
        border: `1px solid ${typeColor}`,
        boxShadow: isHovered ? `0 0 0 2px ${typeColor}` : undefined,
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      tabIndex={0}
      role="checkbox"
      aria-checked={checked}
    >
      <Text style={{ fontSize: 'smaller', color: textColor }}>{typeName}</Text>
    </div>
  )
}

//
// QUESTION TYPE SELECTOR
//

interface QuestionTypeSelectorProps {
  questionTypes: QuestionTypeParams[]
  onChange: (newSelectedTypes: number[]) => void
  value: number[]
  className?: string
  ariaLabel?: string
  ariaLabelledBy?: string
}

export function QuestionTypeSelector({
  questionTypes,
  onChange,
  value,
  className,
  ariaLabel,
  ariaLabelledBy,
}: QuestionTypeSelectorProps): React.ReactElement {
  const [selectedTypes, setSelectedTypes] = useState(value || [])

  const handleTagClick = (typeID, checked) => {
    const newSelectedTypes = checked
      ? [...selectedTypes, typeID]
      : selectedTypes.filter((id) => id !== typeID)

    setSelectedTypes(newSelectedTypes)
    onChange(newSelectedTypes)
  }

  return (
    <div
      className={className}
      role="group"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
    >
      {questionTypes.map((type) =>
        type.name ? ( // don't display question types with no name (e.g. glitched ones)
          <CheckableQuestionType
            key={type.id}
            typeName={type.name}
            typeColor={type.color}
            typeID={type.id}
            checked={selectedTypes.includes(type.id)}
            onChange={handleTagClick}
          />
        ) : null,
      )}
    </div>
  )
}
