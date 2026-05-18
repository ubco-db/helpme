import { Badge, Collapse } from 'antd'
import ExpandableText from '@/app/components/ExpandableText'
import { EmbeddableQuestion } from '@koh/common'

type EmbeddableQuestionDisplayProps = {
  item: EmbeddableQuestion,
  showDates?: boolean,
}

const EmbeddableQuestionDisplay: React.FC<EmbeddableQuestionDisplayProps> = ({
  item,
  showDates = true
}) => {
  return (
    <div className={'flex flex-col gap-2 w-full'}>
      <div className={'flex justify-between'}>
        <b>{item.name}</b>
        {showDates && (
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
        )}
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <Collapse
          bordered={false}
          items={[
            {
              key: 'details',
              label: 'Details',
              children: (
                <>
                  <div className={'grid grid-cols-3'}>
                    <b>Criteria</b>
                    <b>Question</b>
                    <b>Instructions</b>
                  </div>
                  <div className={'grid grid-cols-3'}>
                    <ExpandableText maxRows={2}>
                      {item.criteriaText}
                    </ExpandableText>
                    <ExpandableText maxRows={2}>
                      {item.questionText}
                    </ExpandableText>
                    <ExpandableText maxRows={2}>
                      {item.instructions}
                    </ExpandableText>
                  </div>
                </>
              )
            }
          ]}
        />
      </div>
    </div>
  )
}

export default EmbeddableQuestionDisplay