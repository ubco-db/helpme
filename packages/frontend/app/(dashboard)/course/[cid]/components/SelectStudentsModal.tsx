import { Button, Checkbox, Input, List, Modal, Pagination } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import UserAvatar from '@/app/components/UserAvatar'
import { useState } from 'react'
import { UserPartial } from '@koh/common'

type SelectStudentsModalProps = {
  open: boolean
  onClose: () => void
  page: number
  setPage: (p: number) => void
  students: UserPartial[]
  totalStudents: number
  selectedStudents: number[]
  setSelectedStudents: (ids: number[]) => void
  setFullSearch: (s?: string) => void
  updateSelectedStudents: (id: number) => void
}

const SelectStudentsModal: React.FC<SelectStudentsModalProps> = ({
  open,
  onClose,
  page,
  setPage,
  students,
  totalStudents,
  selectedStudents,
  setSelectedStudents,
  setFullSearch,
  updateSelectedStudents
}) => {
  const [search, setSearch] = useState<string>()

  return (
    <Modal
      title={'Select Students'}
      open={open}
      onCancel={onClose}
      footer={[]}
    >
      <div className={'my-4'}>
        <Input
          placeholder={'Search for students and press enter.'}
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onPressEnter={() => setFullSearch(search)}
          className="my-3"
        />
        <Button onClick={() => setSelectedStudents([])}>
          Reset Selections
        </Button>
        {totalStudents > 50 && (
          <Pagination
            style={{ float: 'right' }}
            current={page}
            pageSize={50}
            total={totalStudents}
            onChange={(page) => setPage(page)}
            showSizeChanger={false}
          />
        )}
        <List
          className="my-2 max-h-96 overflow-y-auto"
          dataSource={students}
          locale={{
            emptyText: 'No students enrolled in course'
          }}
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
  )
}

export default SelectStudentsModal