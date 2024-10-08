import { Button, Modal, Pagination, Checkbox, List, Input } from 'antd'
import { useMemo, useState } from 'react'
import { useInsightContext } from '@/app/(dashboard)/course/[cid]/(insights)/insights/context/InsightsContext'
import { UserPartial } from '@koh/common'
import UserAvatar from '@/app/components/UserAvatar'
import { DownOutlined, SearchOutlined } from '@ant-design/icons'
import FilterWrapper from '@/app/(dashboard)/course/[cid]/(insights)/insights/components/filters/FilterWrapper'

type StudentFilterProps = {
  selectedStudents: number[]
  setSelectedStudents: (value: number[]) => void
}

const StudentFilter: React.FC<StudentFilterProps> = ({
  selectedStudents,
  setSelectedStudents,
}) => {
  const insightContext = useInsightContext()
  const studentDetails = useMemo(
    () => insightContext.studentDetails,
    [insightContext],
  )
  const [modalOpen, setModalOpen] = useState<boolean>(false)
  const [search, setSearch] = useState<string>('')
  const updateSelectedStudents = (student: number) => {
    setSelectedStudents(
      selectedStudents.includes(student)
        ? selectedStudents.filter((s) => s != student)
        : [...selectedStudents, student],
    )
  }

  const onClose = () => {
    setModalOpen(false)
  }

  return (
    studentDetails != undefined && (
      <>
        <Modal
          title={'Select Students'}
          open={modalOpen}
          onCancel={onClose}
          footer={[]}
        >
          <div className={'my-4'}>
            <Input
              placeholder={'Search for students and press enter.'}
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={() => studentDetails.setSearch(search)}
              className="my-3"
            />
            <Button onClick={() => setSelectedStudents([])}>
              Reset Selections
            </Button>
            {studentDetails.totalStudents > 50 && (
              <Pagination
                style={{ float: 'right' }}
                current={studentDetails.page}
                pageSize={50}
                total={studentDetails.totalStudents}
                onChange={(page) => studentDetails.setPage(page)}
                showSizeChanger={false}
              />
            )}
            <List
              className="my-2 max-h-96 overflow-y-auto"
              dataSource={studentDetails.students}
              renderItem={(item: UserPartial) => (
                <List.Item key={item.id} className="flex">
                  <Checkbox
                    className="flex gap-2"
                    checked={selectedStudents.includes(item.id)}
                    onChange={() => updateSelectedStudents(item.id)}
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
        <FilterWrapper title={'Filter Students'}>
          <Button onClick={() => setModalOpen(true)}>
            Selected Students (
            {selectedStudents.length == 0 ? 'All' : selectedStudents.length})
            <DownOutlined color={'@White 65%'} />
          </Button>
        </FilterWrapper>
      </>
    )
  )
}

export default StudentFilter
