import { Badge, Collapse, List } from 'antd'
import { EmbeddableAssignment, EmbeddableQuestion } from '@koh/common'
import EmbeddableQuestionDisplay
  from '@/app/(dashboard)/course/[cid]/(settings)/settings/(embeddable)/components/EmbeddableQuestionDisplay'

type EmbeddableAssignmentDisplayProps = {
  item: EmbeddableAssignment,
}

const EmbeddableAssignmentDisplay: React.FC<EmbeddableAssignmentDisplayProps> = ({
 item,
}) => {
  return (
    <div className={'flex flex-col gap-2 w-full'}>
      <div className={'flex justify-between'}>
        <b>{item.name}</b>
        <div className={'flex gap-2 justify-between'}>
          <Badge color={'blue'} count={item.availableFrom ? (
            `Opened ${new Date(item.availableFrom).toDateString()}`
          ) : (
            'Always open'
          )} />
          <Badge color={'blue'} count={item.availableUntil ? (
            `Closes ${new Date(item.availableUntil).toDateString()}`
          ) : (
            'Never closes'
          )} />
        </div>
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <Collapse
          bordered={false}
          items={[
            {
              key: 'questions',
              label: 'Questions',
              children: (
                <List
                  dataSource={item.questions.map(q => q.question)}
                  renderItem={(item: EmbeddableQuestion) => (
                    <List.Item className={'border:zinc-200 border-2 rounded-md p-2 w-full'}>
                      <EmbeddableQuestionDisplay item={item} showDates={false} />
                    </List.Item>
                  )}
                />
              )
            }
          ]}
        />
      </div>
    </div>
  )
}

export default EmbeddableAssignmentDisplay