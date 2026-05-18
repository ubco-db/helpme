import ExpandableText from '@/app/components/ExpandableText'
import { Tooltip } from 'antd'
import { parseThinkBlock } from '@koh/common'
import { useMemo } from 'react'

export type ExpandableAIResponseProps = {
  maxRows?: 1 | 2 | 3 | 4 | 5 | 6
  response?: string
}

const ExpandableAIResponse: React.FC<ExpandableAIResponseProps> = ({
  maxRows = 3,
  response
}) => {
  const { thinkText, cleanAnswer } = useMemo(() => parseThinkBlock(response ?? ''), [response])
  return (
    <ExpandableText maxRows={maxRows}>
      {thinkText && (
        <Tooltip
          title={`AI Thoughts: ${thinkText}`}
          classNames={{
            body: 'w-96 max-h-[80vh] overflow-y-auto',
          }}
        >
          <span
          className="mr-1 rounded-lg bg-blue-100 p-0.5 pl-1 text-xs"
          onClick={(e) => e.stopPropagation()}
          >
            <i>Thoughts</i> 🧠
          </span>
        </Tooltip>
      )}
      {thinkText ? cleanAnswer : response ? response.toString() : ''}
    </ExpandableText>
  )
}

export default ExpandableAIResponse