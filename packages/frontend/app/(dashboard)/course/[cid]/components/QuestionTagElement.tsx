'use client'

import { useEffect, useMemo, useState } from 'react'
import { QuestionType } from '@koh/common'
import { getBrightness } from '@/app/utils/generalUtils'
import tinycolor from 'tinycolor2'
import { Button, Form, Input, Popover } from 'antd'
import ColorPickerWithPresets from '@/app/components/ColorPickerWithPresets'
import { DeleteOutlined, UndoOutlined } from '@ant-design/icons'

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
  checked: boolean
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement>) => void
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void
  onFocus?: (e: React.FocusEvent<HTMLDivElement>) => void
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
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
  checked,
  // Note that all of these are needed for antd's Popover to work.
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onClick,
  checkStyle = 'default',
  ...props
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

  const handleClick = (e?: React.MouseEvent<HTMLDivElement>) => {
    if (onChangeWithID && tagID) {
      onChangeWithID(tagID, !checked)
    }
    if (onClick && e) {
      onClick(e)
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
  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsHovered(true)
    if (onMouseEnter) {
      onMouseEnter(e)
    }
  }
  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsHovered(false)
    if (onMouseLeave) {
      onMouseLeave(e)
    }
  }
  const handleFocus = (e: React.FocusEvent<HTMLDivElement>) => {
    setIsHovered(true)
    if (onFocus) {
      onFocus(e)
    }
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
      {...props}
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

/** These are stored inside QuestionTagEditor and are used purely for visual purposes */
type LocalQuestionTag = QuestionType & {
  markedForDeletion?: boolean
}

/** These are what QuestionTagEditor "returns" */
export type EditedQuestionTag = {
  markedForDeletion?: boolean
  newValues?: QuestionType
}

interface QuestionTagEditorProps {
  currentTags: QuestionType[]
  onChange?: (newEditedTags: EditedQuestionTag[]) => void
  value?: EditedQuestionTag[]
  className?: string
  [key: string]: any
}

/**
 * This component is used for TAs for deleting question tags for queues.
 * @param currentTags - the current question tags for this queue.
 * @param value - Tag IDs that the TA has marked for deletion but are not yet saved. Will be automatically used by antd's Form.Item
 * @param onChange - the function to call when the tags marked for deletion change. Will be automatically used by antd's Form.Item
 */
const QuestionTagEditor: React.FC<QuestionTagEditorProps> = ({
  currentTags,
  onChange,
  value,
  className,
  ...props
}) => {
  const [localQuestionTags, setLocalQuestionTags] =
    useState<LocalQuestionTag[]>(currentTags)
  const [editedTags, setEditedTags] = useState(value || [])

  // if the currentTags change (like from an outside source), update the localQuestionTags
  useEffect(() => {
    setLocalQuestionTags(currentTags)
  }, [currentTags])

  // whenever editedTags changes, do onChange
  useEffect(() => {
    if (onChange) {
      onChange(editedTags)
    }
  }, [editedTags, onChange])

  const sortedQuestionTags = useMemo(() => {
    // setting numeric: true will essentially perform a natural sort, where 10 is treated one number, thus making it appear after 2
    return [...localQuestionTags].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true }),
    )
  }, [localQuestionTags])

  return (
    <div className={className} role="group" {...props}>
      {sortedQuestionTags.map((tag) => (
        <Popover
          key={'Popover' + tag.id}
          content={
            <div className="fix-antd-form-label flex flex-col gap-y-0">
              {/* Mini popup for editing the question tag */}
              <Form.Item
                label="Name"
                layout="horizontal"
                rules={[
                  { required: true, message: 'Please input a tag name' },
                  {
                    max: 20,
                    message: 'Tag name must be less than 20 characters',
                  },
                  {
                    validator: (_, value) => {
                      // make sure there are no duplicate tag names
                      // The reason we check for 2 is because it includes the current tag
                      const duplicateCount = localQuestionTags.filter(
                        (t) => t.name === value,
                      ).length
                      if (duplicateCount >= 2) {
                        return Promise.reject('Duplicate Tag Name')
                      }
                      return Promise.resolve()
                    },
                  },
                ]}
              >
                <Input
                  allowClear={true}
                  placeholder="Tag Name"
                  maxLength={20}
                  className="w-48"
                  onChange={(e) => {
                    const newName = e.target.value
                    // update the change locally
                    setLocalQuestionTags((prev) =>
                      prev.map((t) =>
                        t.id === tag.id ? { ...t, name: e.target.value } : t,
                      ),
                    )
                    // Update editedTags
                    setEditedTags((prev) => {
                      const existingTag = prev.find(
                        (t) => t.newValues?.id === tag.id,
                      )
                      if (existingTag) {
                        // If it's already in editedTags, update it
                        return prev.map((t) =>
                          t.newValues?.id === tag.id
                            ? {
                                ...t,
                                newValues: { ...t.newValues, name: newName },
                              }
                            : t,
                        )
                      } else {
                        // If it's not already in editedTags, add it
                        return [
                          ...prev,
                          { newValues: { ...tag, name: newName } },
                        ]
                      }
                    })
                  }}
                  value={tag.name}
                />
              </Form.Item>
              <Form.Item label="Color" layout="horizontal">
                <ColorPickerWithPresets
                  value={tag.color}
                  format="hex"
                  defaultFormat="hex"
                  disabledAlpha
                  onChange={(color) => {
                    const newColor =
                      typeof color === 'string' ? color : color.toHexString()

                    // update the change locally
                    setLocalQuestionTags((prev) =>
                      prev.map((t) =>
                        t.id === tag.id ? { ...t, color: newColor } : t,
                      ),
                    )
                    // Update editedTags
                    setEditedTags((prev) => {
                      const existingTag = prev.find(
                        (t) => t.newValues?.id === tag.id,
                      )
                      if (existingTag) {
                        // If it's already in editedTags, update it
                        return prev.map((t) =>
                          t.newValues?.id === tag.id
                            ? {
                                ...t,
                                newValues: { ...t.newValues, color: newColor },
                              }
                            : t,
                        )
                      } else {
                        // If it's not already in editedTags, add it
                        return [
                          ...prev,
                          { newValues: { ...tag, color: newColor } },
                        ]
                      }
                    })
                  }}
                />
              </Form.Item>

              <div className="flex gap-1">
                <Button
                  disabled={!editedTags.find((t) => t.newValues?.id === tag.id)}
                  icon={<UndoOutlined />}
                  onClick={() => {
                    // remove this tag from editedTags and reset the one in localQuestionTags back to currentTags
                    setEditedTags((prev) =>
                      prev.filter((t) => t.newValues?.id !== tag.id),
                    )
                    setLocalQuestionTags((prev) =>
                      prev.map((t) =>
                        t.id === tag.id
                          ? (currentTags.find((ct) => ct.id === tag.id) ?? t)
                          : t,
                      ),
                    )
                  }}
                >
                  Reset
                </Button>

                {tag.markedForDeletion ? (
                  <Button
                    onClick={() => {
                      // update the change locally
                      setLocalQuestionTags((prev) =>
                        prev.map((t) =>
                          t.id === tag.id
                            ? { ...t, markedForDeletion: false }
                            : t,
                        ),
                      )
                      // Update editedTags
                      setEditedTags((prev) => {
                        const existingTag = prev.find(
                          (t) => t.newValues?.id === tag.id,
                        )
                        if (existingTag) {
                          // If it's already in editedTags, update it
                          return prev.map((t) =>
                            t.newValues?.id === tag.id
                              ? { ...t, markedForDeletion: false }
                              : t,
                          )
                        } else {
                          // If it's not already in editedTags, add it
                          return [
                            ...prev,
                            { markedForDeletion: false, newValues: tag },
                          ]
                        }
                      })
                    }}
                  >
                    Unmark for Deletion
                  </Button>
                ) : (
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => {
                      // update the change locally
                      setLocalQuestionTags((prev) =>
                        prev.map((t) =>
                          t.id === tag.id
                            ? { ...t, markedForDeletion: true }
                            : t,
                        ),
                      )
                      // Update editedTags
                      setEditedTags((prev) => {
                        const existingTag = prev.find(
                          (t) => t.newValues?.id === tag.id,
                        )
                        if (existingTag) {
                          // If it's already in editedTags, update it
                          return prev.map((t) =>
                            t.newValues?.id === tag.id
                              ? { ...t, markedForDeletion: true }
                              : t,
                          )
                        } else {
                          // If it's not already in editedTags, add it
                          return [
                            ...prev,
                            { markedForDeletion: true, newValues: tag },
                          ]
                        }
                      })
                    }}
                  >
                    Mark for Deletion
                  </Button>
                )}
              </div>
            </div>
          }
          trigger="click"
          getPopupContainer={(trigger) => trigger.parentNode as HTMLElement}
        >
          <CheckableQuestionTag
            key={tag.id}
            tagName={tag.name}
            tagColor={tag.color}
            // "checked" tasks are tasks that are marked for deletion for this component
            checked={!!tag.markedForDeletion}
            checkStyle="delete"
          />
        </Popover>
      ))}
    </div>
  )
}

export {
  QuestionTagElement,
  QuestionTagSelector,
  CheckableQuestionTag,
  QuestionTagEditor,
}
