'use client'

import { useMemo, useState } from 'react'
import { QuestionType } from '@koh/common'
import { getBrightness } from '@/app/utils/generalUtils'
import tinycolor from 'tinycolor2'

interface QuestionTagElementProps {
  tagName: string
  tagColor: string
  onClick?: () => void
  className?: string
}

/**
 * This is the main component for displaying a question tag. Named QuestionTagElement to avoid confusion with types and variables.
 */
const QuestionTagElement: React.FC<QuestionTagElementProps> = ({
  tagName,
  tagColor,
  onClick,
  className,
}) => {
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
        cursor: onClick ? 'pointer' : '',
        border: `1px solid ${tinycolor(tagColor).darken(10).toString()}`,
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

interface CheckableQuestionTagProps {
  tagName: string
  tagColor: string
  tagID?: number
  onChangeWithID?: (tagID: number, checked: boolean) => void
  onChangeWithName?: (tagName: string) => void
  checked: boolean
  checkStyle?: 'default' | 'delete'
}

/**
 * A component that displays a question tag that can be checked or unchecked.
 * @param checkStyle - what the tag will look like when it's checked. 'default' is a filled in tag, 'delete' is a tag with crossed out text.
 */
const CheckableQuestionTag: React.FC<CheckableQuestionTagProps> = ({
  tagName,
  tagColor,
  tagID,
  onChangeWithID,
  onChangeWithName,
  checked,
  checkStyle = 'default',
}) => {
  // if checkStyle is delete, text color is dark or light red when checked and normal when unchecked.
  // If checkStyle is default, the text color is normal when checked and gray when unchecked.
  const textColor =
    checkStyle === 'default'
      ? checked
        ? getBrightness(tagColor) < 128
          ? 'white'
          : 'black'
        : 'gray'
      : checkStyle === 'delete'
        ? checked
          ? getBrightness(tagColor) < 128
            ? 'lightcoral'
            : 'darkred'
          : getBrightness(tagColor) < 128
            ? 'white'
            : 'black'
        : 'gray'

  const handleClick = () => {
    if (onChangeWithID && tagID) {
      onChangeWithID(tagID, !checked)
    }
    if (onChangeWithName) {
      onChangeWithName(tagName)
    }
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
        backgroundColor:
          checkStyle === 'delete' ? tagColor : checked ? tagColor : undefined,
        borderRadius: '15px',
        padding: '4px 9px',
        margin: '2px',
        display: 'inline-block',
        cursor: 'pointer',
        border: `1px solid ${tinycolor(tagColor).darken(10).toString()}`,
        boxShadow: isHovered
          ? `0 0 0 2px ${tinycolor(tagColor).darken(10).toString()}`
          : undefined,
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
      <div style={{ fontSize: 'smaller', color: textColor }}>
        {checkStyle === 'delete' && checked ? (
          <s
            style={{
              display: checkStyle === 'delete' && checked ? 'inline' : 'none',
            }}
          >
            {tagName}
          </s>
        ) : (
          tagName
        )}
      </div>
    </div>
  )
}

interface QuestionTagSelectorProps {
  questionTags: QuestionType[]
  onChange?: (newSelectedTags: number[]) => void
  value?: number[]
  className?: string
  [key: string]: any
}

/**
 * A component that allows the user to select from a list of question tags.
 */
const QuestionTagSelector: React.FC<QuestionTagSelectorProps> = ({
  questionTags,
  onChange,
  value,
  className,
  ...props
}) => {
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

  const sortedQuestionTags = useMemo(() => {
    // setting numeric: true will essentially perform a natural sort, where 10 is treated one number, thus making it appear after 2
    return [...questionTags].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true }),
    )
  }, [questionTags])

  return (
    <div className={className} role="group" {...props}>
      {sortedQuestionTags.map((tag) =>
        tag.name ? ( // don't display question tags with no name (e.g. glitched ones)
          <CheckableQuestionTag
            key={tag.id}
            tagName={tag.name}
            tagColor={tag.color}
            tagID={tag.id}
            checked={selectedTags.includes(tag.id)}
            onChangeWithID={handleTagClick}
          />
        ) : null,
      )}
    </div>
  )
}

interface QuestionTagDeleteSelectorProps {
  currentTags: QuestionType[]
  onChange?: (newSelectedTags: number[]) => void
  value?: number[]
  className?: string
  [key: string]: any
}

/**
 * This component is used for TAs for deleting question tags for queues.
 * @param currentTags - the current question tags for this queue.
 * @param value - Tag IDs that the TA has marked for deletion but are not yet saved. Will be automatically used by antd's Form.Item
 * @param onChange - the function to call when the tags marked for deletion change. Will be automatically used by antd's Form.Item
 */
const QuestionTagDeleteSelector: React.FC<QuestionTagDeleteSelectorProps> = ({
  currentTags,
  onChange,
  value,
  className,
  ...props
}) => {
  const [selectedTags, setSelectedTags] = useState(value || [])

  const handleCurrentTagClick = (tagID: number, checked: boolean) => {
    const newSelectedTags = checked
      ? [...selectedTags, tagID]
      : selectedTags.filter((id) => id !== tagID)

    setSelectedTags(newSelectedTags)
    if (onChange) {
      onChange(newSelectedTags)
    }
  }

  const sortedQuestionTags = useMemo(() => {
    // setting numeric: true will essentially perform a natural sort, where 10 is treated one number, thus making it appear after 2
    return [...currentTags].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true }),
    )
  }, [currentTags])

  return (
    <div className={className} role="group" {...props}>
      {sortedQuestionTags.map((tag) => (
        <CheckableQuestionTag
          key={tag.id}
          tagName={tag.name}
          tagColor={tag.color}
          tagID={tag.id}
          // "checked" tasks are tasks that are marked for deletion for this component
          checked={selectedTags.includes(tag.id)}
          onChangeWithID={handleCurrentTagClick}
          checkStyle="delete"
        />
      ))}
    </div>
  )
}

export {
  QuestionTagElement,
  QuestionTagSelector,
  CheckableQuestionTag,
  QuestionTagDeleteSelector,
}
