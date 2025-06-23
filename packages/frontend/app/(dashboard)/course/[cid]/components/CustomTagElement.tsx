'use client'

import { getBrightness, stringToColor } from '@/app/utils/generalUtils'
import tinycolor from 'tinycolor2'

interface CustomTagElementProps {
  tagName: string
  onClose?: () => void
  className?: string
  [key: string]: any
}

/**
 * A simple display component for a custom tag.
 */
export const CustomTagElement: React.FC<CustomTagElementProps> = ({
  tagName,
  onClose,
  className,
  ...props
}) => {
  // Generate a consistent color from the tag name
  const tagColor = stringToColor(tagName)
  const textColor = getBrightness(tagColor) < 128 ? 'white' : 'black'

  return (
    <div
      style={{
        backgroundColor: tagColor,
        borderRadius: '15px',
        padding: '0px 7px',
        margin: '2px',
        display: 'inline-block',
        border: `1px solid ${tinycolor(tagColor).darken(10).toString()}`,
      }}
      className={className}
      {...props}
    >
      <div style={{ fontSize: 'smaller', color: textColor }}>
        {tagName ?? 'error: missing tag text'}
        {onClose && (
          <span
            onClick={onClose}
            style={{ cursor: 'pointer', marginLeft: '4px' }}
          >
            x
          </span>
        )}
      </div>
    </div>
  )
}
