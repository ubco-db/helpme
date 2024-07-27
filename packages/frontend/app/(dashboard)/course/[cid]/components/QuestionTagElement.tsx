import { ReactElement, useState } from 'react'
import { QuestionType } from '@koh/common'

//
// QUESTION TAGS
//
interface QuestionTagElementProps {
  tagName: string
  tagColor: string
  onClick?: () => void
  className?: string
}
export function QuestionTagElement({
  tagName,
  tagColor,
  onClick,
  className,
}: QuestionTagElementProps): ReactElement {
  function getBrightness(color: string): number {
    const rgb = parseInt(color.slice(1), 16)
    const r = (rgb >> 16) & 0xff
    const g = (rgb >> 8) & 0xff
    const b = (rgb >> 0) & 0xff
    return (r * 299 + g * 587 + b * 114) / 1000
  }
  const textColor = !tagName
    ? 'red'
    : getBrightness(tagColor) < 128
      ? 'white'
      : 'black'

  return (
    <div
      style={{
        backgroundColor: tagColor,
        borderRadius: '15px',
        padding: '0px 7px',
        margin: '2px',
        display: 'inline-block',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
      className={className}
    >
      <div style={{ fontSize: 'smaller', color: textColor }}>
        {tagName ?? 'error: missing tag text'}
      </div>
    </div>
  )
}

//
// CHECKABLE (like checkbox) QUESTION TAGS
//

interface CheckableQuestionTagProps {
  tagName: string
  tagColor: string
  tagID: number
  onChange: (tagID: number, checked: boolean) => void
  checked: boolean
}

export function CheckableQuestionTag({
  tagName,
  tagColor,
  tagID,
  onChange,
  checked,
}: CheckableQuestionTagProps): React.ReactElement {
  function getBrightness(color: string): number {
    const rgb = parseInt(color.slice(1), 16)
    const r = (rgb >> 16) & 0xff
    const g = (rgb >> 8) & 0xff
    const b = (rgb >> 0) & 0xff
    return (r * 299 + g * 587 + b * 114) / 1000
  }
  const textColor = checked
    ? getBrightness(tagColor) < 128
      ? 'white'
      : 'black'
    : 'gray'

  const handleClick = () => {
    onChange(tagID, !checked)
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
        backgroundColor: checked ? tagColor : undefined,
        borderRadius: '15px',
        padding: '4px 9px',
        margin: '2px',
        display: 'inline-block',
        cursor: 'pointer',
        border: `1px solid ${tagColor}`,
        boxShadow: isHovered ? `0 0 0 2px ${tagColor}` : undefined,
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
      <div style={{ fontSize: 'smaller', color: textColor }}>{tagName}</div>
    </div>
  )
}

//
// QUESTION TAG SELECTOR
//

interface QuestionTagSelectorProps {
  questionTags: QuestionType[]
  onChange?: (newSelectedTags: number[]) => void
  value?: number[]
  className?: string
  ariaLabel?: string
  ariaLabelledBy?: string
}

export function QuestionTagSelector({
  questionTags,
  onChange,
  value,
  className,
  ariaLabel,
  ariaLabelledBy,
}: QuestionTagSelectorProps): React.ReactElement {
  const [selectedTags, setSelectedTags] = useState(value || [])

  const handleTagClick = (tagID: number, checked: boolean) => {
    const newSelectedTags = checked
      ? [...selectedTags, tagID]
      : selectedTags.filter((id) => id !== tagID)

    setSelectedTags(newSelectedTags)
    if (onChange) {
      onChange(newSelectedTags)
    }
  }

  return (
    <div
      className={className}
      role="group"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
    >
      {questionTags.map((tag) =>
        tag.name ? ( // don't display question tags with no name (e.g. glitched ones)
          <CheckableQuestionTag
            key={tag.id}
            tagName={tag.name}
            tagColor={tag.color}
            tagID={tag.id}
            checked={selectedTags.includes(tag.id)}
            onChange={handleTagClick}
          />
        ) : null,
      )}
    </div>
  )
}
