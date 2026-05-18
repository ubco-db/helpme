import { Divider, List } from 'antd'
import { EmbeddableAssignment } from '@koh/common'
import EmbeddableAssignmentDisplay
  from '@/app/(dashboard)/course/[cid]/(settings)/settings/(embeddable)/components/EmbeddableAssignmentDisplay'

export type SelectEmbeddableAssignmentProps = {
  assignments: EmbeddableAssignment[]
  onSelect: (n: number) => void,
}

const SelectEmbeddableAssignment: React.FC<SelectEmbeddableAssignmentProps> = ({
  assignments,
  onSelect,
}) => {
  return (
    <List
      dataSource={assignments}
      locale={{
        emptyText: 'No embeddable questions created for course'
      }}
      renderItem={(item: EmbeddableAssignment) => (
        <>
          <List.Item className={'hover:border-helpmeblue-light border:zinc-200 border-2 rounded-md p-2 w-full transition-all'} onClick={() => onSelect(item.id)}>
            <EmbeddableAssignmentDisplay item={item} />
          </List.Item>
          <Divider />
        </>
      )}
    />
  )
}

export default SelectEmbeddableAssignment