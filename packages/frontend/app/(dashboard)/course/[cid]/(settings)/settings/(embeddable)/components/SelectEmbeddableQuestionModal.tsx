import { Modal } from 'antd'
import { useEffect, useState } from 'react'
import SelectEmbeddableQuestion, {
  SelectEmbeddableQuestionProps,
} from '@/app/(dashboard)/course/[cid]/(settings)/settings/(embeddable)/components/SelectEmbeddableQuestion'

type SelectEmbeddableQuestionModalProps = {
  open: boolean,
  onClose: () => void
  disabled?: number[]
  onMultiSelect?: (n: number[]) => void
  mode?: 'multi' | 'single',
  showDates?: boolean
} & SelectEmbeddableQuestionProps

const SelectEmbeddableQuestionModal: React.FC<SelectEmbeddableQuestionModalProps> = ({
  open,
  onClose,
  questions,
  onSelect,
  onMultiSelect,
  disabled = [],
  mode = 'single',
  showDates = true,
}) => {
  const [selectedQuestion, setSelectedQuestion] = useState<number>()
  const [selectedQuestions, setSelectedQuestions] = useState<number[]>([])

  useEffect(() => {
    if (!open)
      setSelectedQuestions([])
      setSelectedQuestion(undefined)
  }, [open])

  return (
    <Modal
      title={`Select Embeddable Question${mode === 'multi' ? 's' : ''}`}
      open={open}
      onCancel={onClose}
      okButtonProps={{ disabled: mode === 'multi' ? selectedQuestions.length <= 0 : !selectedQuestion }}
      onOk={() => {
        if ((mode === 'multi' && selectedQuestions.length <= 0) || (mode !== 'multi' && !selectedQuestion)) return
        if (mode === 'multi' && onMultiSelect)
          onMultiSelect(selectedQuestions)
        else if (mode !== 'multi' && onSelect)
          onSelect(selectedQuestion!)
        onClose()
      }}
    >
      <div className={'max-h-[50vh] overflow-y-auto overflow-x-hidden'}>
        <SelectEmbeddableQuestion
          questions={questions}
          selectedQuestion={mode === 'multi' ? selectedQuestions : selectedQuestion}
          onSelect={(n) => {
            if (mode === 'multi') {
              setSelectedQuestions(prev => prev.includes(n) ? prev.filter(v => v != n) : [...prev, n])
              return
            }
            setSelectedQuestion(n)
          }}
          disabled={disabled}
          showDates={showDates}
        />
      </div>
    </Modal>
)
}

export default SelectEmbeddableQuestionModal

