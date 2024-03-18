import React, { useState } from 'react'
import PropTypes from 'prop-types'

const ExpandableText = ({ text, maxLength = 200 }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const shouldTruncate = text.length > maxLength
  const displayedText =
    isExpanded || !shouldTruncate ? text : `${text.substring(0, maxLength)}...`

  return (
    <div>
      <span className="inline-block overflow-hidden text-ellipsis">
        {displayedText}
      </span>
      {shouldTruncate && (
        <button
          className="ml-2 text-blue-500 hover:text-blue-700"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Less' : 'More'}
        </button>
      )}
    </div>
  )
}

ExpandableText.propTypes = {
  text: PropTypes.string.isRequired,
  maxLength: PropTypes.number,
}

export default ExpandableText
