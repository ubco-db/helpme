import { Divider, List, Table } from 'antd'
import { cn } from '@/app/utils/generalUtils'
import { EmbeddableQuestion } from '@koh/common'
import ExpandableText from '@/app/components/ExpandableText'

export type SelectEmbeddableQuestionProps = {
  questions: EmbeddableQuestion[]
  selectedQuestion?: number
  setSelectedQuestion: (n: number) => void
}

const SelectEmbeddableQuestion: React.FC<SelectEmbeddableQuestionProps> = ({
  questions,
  selectedQuestion,
  setSelectedQuestion
}) => {
  return (
    <List
      dataSource={questions}
      locale={{
        emptyText: 'No embeddable questions created for course'
      }}
      renderItem={(item: EmbeddableQuestion, index: number) => (
        <>
          <Divider/>
          <List.Item className={cn(item.id === selectedQuestion ? 'border-helpmeblue' : '', 'hover:border-helpmeblue-light border:zinc-200 border-2 rounded-md')} onClick={() => setSelectedQuestion(item.id)}>
            <Table
              dataSource={[item]}
              columns={[
                {
                  dataIndex: 'name',
                  render: (val) => (
                    <b>{val ?? `Question ${index+1}`}</b>
                  )
                },
                {
                  dataIndex: 'availableFrom',
                  render: (val) => (
                    val ? (
                      `Opened ${new Date(val).toDateString()}`
                    ) : (
                      'Always open'
                    )
                  )
                },
                {
                  dataIndex: 'availableUntil',
                  render: (val) => (
                    val ? (
                      `Closes ${new Date(val).toDateString()}`
                    ) : (
                      'Never closes'
                    )
                  )
                },
                {
                  dataIndex: 'questionText',
                  render: (text) => (
                    <ExpandableText maxRows={2}>
                      {text || ''}
                    </ExpandableText>
                  )
                },
                {
                  dataIndex: 'criteriaText',
                  render: (text) => (
                    <ExpandableText maxRows={2}>
                      {text || ''}
                    </ExpandableText>
                  )
                },
                {
                  dataIndex: 'instructions',
                  render: (text) => (
                    <ExpandableText maxRows={2}>
                      {text || ''}
                    </ExpandableText>
                  )
                },
              ]}
              showHeader={false}
              pagination={false}
            />
          </List.Item>
          <Divider/>
        </>
      )}
    />
  )
}

export default SelectEmbeddableQuestion