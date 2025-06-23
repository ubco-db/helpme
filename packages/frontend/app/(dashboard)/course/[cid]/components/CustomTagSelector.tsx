'use client'

import { useState } from 'react'
import { Input, Button } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { CustomTagElement } from './CustomTagElement'

interface CustomTagSelectorProps {
  onChange?: (newCustomTags: string[]) => void
  value?: string[]
  className?: string
  [key: string]: any
}

/**
 * A component that allows the user to create and select a list of custom, temporary tags.
 */
export const CustomTagSelector: React.FC<CustomTagSelectorProps> = ({
  onChange,
  value = [],
  className,
  ...props
}) => {
  const [customTags, setCustomTags] = useState<string[]>(value)
  const [newTagInput, setNewTagInput] = useState('')

  const handleAddTag = () => {
    if (newTagInput && !customTags.includes(newTagInput)) {
      const newTags = [...customTags, newTagInput]
      setCustomTags(newTags)
      onChange?.(newTags)
      setNewTagInput('')
    }
  }

  const handleRemoveTag = (removedTag: string) => {
    const newTags = customTags.filter((tag) => tag !== removedTag)
    setCustomTags(newTags)
    onChange?.(newTags)
  }

  return (
    <div className={className} {...props}>
      <div className="flex items-center gap-2">
        <Input
          value={newTagInput}
          onChange={(e) => setNewTagInput(e.target.value)}
          onPressEnter={handleAddTag}
          placeholder="Add a custom tag"
        />
        <Button icon={<PlusOutlined />} onClick={handleAddTag} type="primary">
          Add
        </Button>
      </div>
      <div className="mt-2">
        {customTags.map((tag) => (
          <CustomTagElement
            key={tag}
            tagName={tag}
            onClose={() => handleRemoveTag(tag)}
          />
        ))}
      </div>
    </div>
  )
}
