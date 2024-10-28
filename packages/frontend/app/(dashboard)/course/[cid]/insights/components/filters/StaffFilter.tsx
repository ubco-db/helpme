import { Button, Modal, Pagination, Checkbox, List, Input } from 'antd'
import { useMemo, useState } from 'react'
import { useInsightContext } from '@/app/(dashboard)/course/[cid]/insights/context/InsightsContext'
import { UserPartial } from '@koh/common'
import UserAvatar from '@/app/components/UserAvatar'
import { DownOutlined, SearchOutlined } from '@ant-design/icons'
import FilterWrapper from '@/app/(dashboard)/course/[cid]/insights/components/filters/FilterWrapper'

type StaffFilterProps = {
  selectedStaff: number[]
  setSelectedStaff: (value: number[]) => void
}

const StaffFilter: React.FC<StaffFilterProps> = ({
  selectedStaff,
  setSelectedStaff,
}) => {
  const insightContext = useInsightContext()
  const staffDetails = useMemo(
    () => insightContext.staffDetails,
    [insightContext],
  )
  const [modalOpen, setModalOpen] = useState<boolean>(false)
  const [search, setSearch] = useState<string>('')
  const updateSelectedStaff = (student: number) => {
    setSelectedStaff(
      selectedStaff.includes(student)
        ? selectedStaff.filter((s) => s != student)
        : [...selectedStaff, student],
    )
  }

  const onClose = () => {
    setModalOpen(false)
  }

  return (
    staffDetails != undefined && (
      <>
        <Modal
          title={'Select Staff'}
          open={modalOpen}
          onCancel={onClose}
          footer={[]}
        >
          <div className={'my-4'}>
            <Input
              placeholder={'Search for staff and press enter.'}
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={() => staffDetails.setSearch(search)}
              className="my-3"
            />
            <Button onClick={() => setSelectedStaff([])}>
              Reset Selections
            </Button>
            {staffDetails.totalStaff > 50 && (
              <Pagination
                style={{ float: 'right' }}
                current={staffDetails.page}
                pageSize={50}
                total={staffDetails.totalStaff}
                onChange={(page) => staffDetails.setPage(page)}
                showSizeChanger={false}
              />
            )}
            <List
              className="my-2 max-h-96 overflow-y-auto"
              dataSource={staffDetails.staff}
              renderItem={(item: UserPartial) => (
                <List.Item key={item.id} className="flex">
                  <Checkbox
                    className="flex gap-2"
                    checked={selectedStaff.includes(item.id)}
                    onChange={() => updateSelectedStaff(item.id)}
                  >
                    <UserAvatar
                      photoURL={item.photoURL}
                      username={item.name ?? ''}
                    />
                    <span className="ml-2">{item.name}</span>
                  </Checkbox>
                </List.Item>
              )}
              bordered
            />
          </div>
        </Modal>
        <FilterWrapper title={'Filter Staff'}>
          <Button onClick={() => setModalOpen(true)}>
            Selected Staff (
            {selectedStaff.length == 0 ? 'All' : selectedStaff.length})
            <DownOutlined color={'@White 65%'} />
          </Button>
        </FilterWrapper>
      </>
    )
  )
}

export default StaffFilter
