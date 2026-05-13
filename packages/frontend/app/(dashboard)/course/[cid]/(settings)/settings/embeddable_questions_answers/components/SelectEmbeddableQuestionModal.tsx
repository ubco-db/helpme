import { Modal } from 'antd'
import SelectEmbeddableQuestion, {
  SelectEmbeddableQuestionProps,
} from '@/app/(dashboard)/course/[cid]/(settings)/settings/embeddable_questions_answers/components/SelectEmbeddableQuestion'

type SelectEmbeddableQuestionModalProps = {
  open: boolean,
  onClose: () => void
} & SelectEmbeddableQuestionProps

const SelectEmbeddableQuestionModal: React.FC<SelectEmbeddableQuestionModalProps> = ({
  open,
  onClose,
  questions,
  selectedQuestion,
  setSelectedQuestion
}) => {
  return (
    <Modal
      title={'Select Embeddable Question'}
      open={open}
      onCancel={onClose}
      footer={[]}
    >
      <SelectEmbeddableQuestion
        questions={questions}
        selectedQuestion={selectedQuestion}
        setSelectedQuestion={setSelectedQuestion}
      />
    </Modal>
  )
}

export default SelectEmbeddableQuestionModal

