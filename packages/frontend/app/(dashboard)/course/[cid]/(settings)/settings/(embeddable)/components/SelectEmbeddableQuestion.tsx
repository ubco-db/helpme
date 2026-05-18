import { List } from 'antd'
import { cn } from '@/app/utils/generalUtils'
import { EmbeddableQuestion } from '@koh/common'
import EmbeddableQuestionDisplay
  from '@/app/(dashboard)/course/[cid]/(settings)/settings/(embeddable)/components/EmbeddableQuestionDisplay'

export type SelectEmbeddableQuestionProps = {
  questions: EmbeddableQuestion[]
  selectedQuestion?: number | number[]
  onSelect?: (n: number) => void
  disabled?: number[]
  showDates?: boolean
}

const SelectEmbeddableQuestion: React.FC<SelectEmbeddableQuestionProps> = ({
  questions,
  selectedQuestion,
  onSelect,
  disabled = [],
  showDates = true,
}) => {
  return (
    <List
      dataSource={questions}
      locale={{
        emptyText: 'No embeddable questions created for course'
      }}
      renderItem={(item: EmbeddableQuestion) => (
        <List.Item
          className={cn(
            (selectedQuestion != undefined && Array.isArray(selectedQuestion)
              ? selectedQuestion.includes(item.id)
              : item.id === selectedQuestion
            ) ? 'border-helpmeblue hover:border-red-400'
              : !disabled.includes(item.id)
                ? 'hover:border-helpmeblue-light border:zinc-200 cursor-pointer'
                : 'border-zinc-400 bg-zinc-300 cursor-not-allowed',
            'border-2 rounded-lg p-4 w-full transition-all my-2'
          )}
          onClick={() => {
            if (disabled.includes(item.id)) return
            if (onSelect)
              onSelect(item.id)
          }}>
          <EmbeddableQuestionDisplay item={item} showDates={showDates} />
        </List.Item>
      )}
    />
  )
}

export default SelectEmbeddableQuestion