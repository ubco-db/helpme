import { Button } from 'antd'
import { useMemo, useState } from 'react'
import { useInsightContext } from '@/app/(dashboard)/course/[cid]/(insights)/context/InsightsContext'
import { DownOutlined } from '@ant-design/icons'
import FilterWrapper from '@/app/(dashboard)/course/[cid]/(insights)/components/filters/FilterWrapper'
import SelectStudentsModal from '@/app/(dashboard)/course/[cid]/components/SelectStudentsModal'

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
        <SelectStudentsModal
          open={modalOpen}
          onClose={onClose}
          page={studentDetails.page}
          setPage={studentDetails.setPage}
          students={studentDetails.students}
          totalStudents={studentDetails.totalStudents}
          selectedStudents={selectedStudents}
          setSelectedStudents={setSelectedStudents}
          setFullSearch={studentDetails.setSearch}
          updateSelectedStudents={updateSelectedStudents}
        />
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
