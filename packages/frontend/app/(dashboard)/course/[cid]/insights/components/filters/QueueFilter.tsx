import { Button, Modal, Checkbox, List, Input } from 'antd'
import { useMemo, useState } from 'react'
import { useInsightContext } from '@/app/(dashboard)/course/[cid]/insights/context/InsightsContext'
import { QueuePartial } from '@koh/common'
import { DownOutlined, SearchOutlined } from '@ant-design/icons'
import FilterWrapper from '@/app/(dashboard)/course/[cid]/insights/components/filters/FilterWrapper'

type QueueFilterProps = {
  selectedQueues: number[]
  setSelectedQueues: (value: number[]) => void
}

const QueueFilter: React.FC<QueueFilterProps> = ({
  selectedQueues,
  setSelectedQueues,
}) => {
  const insightContext = useInsightContext()
  const queueDetails = useMemo(
    () => insightContext.queueDetails,
    [insightContext],
  )

  const [modalOpen, setModalOpen] = useState<boolean>(false)
  const [search, setSearch] = useState<string>('')

  const updateSelectedQueues = (queue: number) => {
    setSelectedQueues(
      selectedQueues.includes(queue)
        ? selectedQueues.filter((s) => s != queue)
        : [...selectedQueues, queue],
    )
  }

  const onClose = () => {
    setModalOpen(false)
  }

  return (
    queueDetails != undefined && (
      <>
        <Modal
          title={'Select Queues'}
          open={modalOpen}
          onCancel={onClose}
          footer={[]}
        >
          <div className={'my-4'}>
            <Input
              placeholder={'Search for queues.'}
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="my-3"
            />
            <Button onClick={() => setSelectedQueues([])}>
              Reset Selections
            </Button>
            <List
              className="my-2 max-h-96 overflow-y-auto"
              dataSource={queueDetails}
              renderItem={(item: QueuePartial) => (
                <List.Item key={item.id} className="flex">
                  <Checkbox
                    className="flex justify-between gap-2"
                    checked={selectedQueues.includes(item.id)}
                    onChange={() => updateSelectedQueues(item.id)}
                  >
                    <span>{item.room}</span>
                    {item.isProfessorQueue && (
                      <span>
                        <i>Professor Queue</i>
                      </span>
                    )}
                  </Checkbox>
                </List.Item>
              )}
              bordered
            />
          </div>
        </Modal>
        <FilterWrapper title={'Filter Queues'}>
          <Button onClick={() => setModalOpen(true)}>
            Selected Queues (
            {selectedQueues.length == 0 ? 'All' : selectedQueues.length})
            <DownOutlined color={'@White 65%'} />
          </Button>
        </FilterWrapper>
      </>
    )
  )
}

export default QueueFilter
