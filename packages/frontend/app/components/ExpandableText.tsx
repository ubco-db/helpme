import { Button } from 'antd'
import React, { useEffect, useRef, useState } from 'react'
import { cn } from '../utils/generalUtils'
import { DownOutlined, UpOutlined } from '@ant-design/icons'
import styles from './ExpandableText.module.css'

const debounce = <T extends (...args: any[]) => void>(
  func: T,
  delay: number,
) => {
  let timeoutId: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      func(...args)
    }, delay)
  }
}

interface ExpandableTextProps {
  children: React.ReactNode
  maxRows?: 1 | 2 | 3 | 4 | 5 | 6
}

/**
 * Text with an animation to expand and collapse the text
 * @param children The text to display
 * @param maxRows The initial number of rows of text to display
 */
const ExpandableText: React.FC<ExpandableTextProps> = ({
  children,
  maxRows = 1,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [truncateText, setTruncateText] = useState(true) // after the max-height transition is finished on expanding the text, truncate it to show a `...`
  const [isOverflowing, setIsOverflowing] = useState(false) // used to show "More/Less" button
  const textRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const checkOverflow = debounce(() => {
      // add a debounce to prevent lessen performance hit of spamming checkOverflow from the observer
      if (textRef.current) {
        const maxHeight = maxRows * 1.5 * 16 // 1.5rem in pixels (assuming 1rem = 16px)
        setIsOverflowing(textRef.current.scrollHeight > maxHeight)
      }
    }, 200)
    const resizeObserver = new ResizeObserver(checkOverflow)
    if (textRef.current) {
      resizeObserver.observe(textRef.current)
    }
    // Initial check
    checkOverflow()
    return () => {
      if (textRef.current) {
        resizeObserver.unobserve(textRef.current)
      }
    }
  }, [maxRows])

  return (
    <div className="flex flex-col justify-center">
      <div
        ref={textRef}
        className={cn(styles.expandableText, isExpanded ? styles.expanded : '')}
        style={{
          maxHeight: `calc(${maxRows} * 1.5rem)`,
          overflow: truncateText ? 'hidden' : undefined,
          WebkitLineClamp: truncateText ? maxRows : undefined,
          display: truncateText ? '-webkit-box' : undefined,
          WebkitBoxOrient: truncateText ? 'vertical' : undefined,
        }}
      >
        {children}
      </div>
      {isOverflowing && (
        <Button
          size="small"
          type="link"
          onClick={() => {
            setIsExpanded(!isExpanded)
            // after the max-height transition is finished on expanding the text, truncate it to show a `...`
            // truncating the questionText before the animation is finished will cause the animation to jump
            // Also, this logic is reversed for some reason
            if (isExpanded) {
              //// Collapsing the card
              setTimeout(() => {
                setTruncateText(true)
              }, 300)
            } else {
              //// Expanding the card
              // however, we do want to instantly remove the truncation when expanding the card
              setTruncateText(false)
            }
          }}
          icon={isExpanded ? <UpOutlined /> : <DownOutlined />}
        >
          {isExpanded ? 'Less' : 'More'}
        </Button>
      )}
    </div>
  )
}

export default ExpandableText
