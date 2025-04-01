import { CourseResponse, SemesterPartial } from '@koh/common'
import { Checkbox, Form, Select, Table } from 'antd'
import { useState } from 'react'

type SelectCoursesProps = {
  courses: CourseResponse[]
  selectedCourses: number[]
  setSelectedCourses: (selectedCourses: number[]) => void
  organizationSemesters: SemesterPartial[]
}

const SelectCourses: React.FC<SelectCoursesProps> = ({
  courses,
  selectedCourses,
  setSelectedCourses,
  organizationSemesters,
}) => {
  const [filterSemesterId, setFilterSemesterId] = useState<number>(-1)

  // Filter courses based on the selected semester filter
  const filteredCourses = courses.filter(
    (course) =>
      filterSemesterId === -1 || course.semesterId === filterSemesterId,
  )

  // Check if all filtered courses are selected
  const allSelected = filteredCourses.every((course) =>
    selectedCourses.includes(course.courseId),
  )

  // Toggle select all for filtered list
  const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const updated = Array.from(
        new Set([
          ...selectedCourses,
          ...filteredCourses.map((course) => course.courseId),
        ]),
      )
      setSelectedCourses(updated)
    } else {
      const updated = selectedCourses.filter(
        (id) => !filteredCourses.some((course) => course.courseId === id),
      )
      setSelectedCourses(updated)
    }
  }

  // Toggle individual course selection
  const toggleCourseSelection = (courseId: number, checked: boolean) => {
    if (checked) {
      setSelectedCourses([...selectedCourses, courseId])
    } else {
      setSelectedCourses(selectedCourses.filter((id) => id !== courseId))
    }
  }

  // Define columns for the antd Table
  const columns = [
    {
      title: 'Course Name',
      dataIndex: 'courseName',
      key: 'courseName',
    },
    {
      title: 'Section Group',
      dataIndex: 'sectionGroupName',
      key: 'sectionGroupName',
    },
    {
      title: 'Semester',
      dataIndex: 'semesterId',
      key: 'semester',
      render: (semesterId: number) =>
        organizationSemesters.find((s) => s.id === semesterId)?.name || 'N/A',
    },
    {
      title: (
        <Checkbox checked={allSelected} onChange={() => toggleSelectAll} />
      ),
      key: 'select',
      render: (_: any, record: CourseResponse) => (
        <Checkbox
          checked={selectedCourses.includes(record.courseId)}
          onChange={(e) =>
            toggleCourseSelection(record.courseId, e.target.checked)
          }
        />
      ),
    },
  ]

  return (
    <div>
      <Form layout="inline" style={{ marginBottom: 16 }}>
        <Form.Item label="Filter by Semester:">
          <Select
            placeholder="Select Semester"
            onChange={(value: number) => setFilterSemesterId(value)}
            value={filterSemesterId}
            style={{ width: 300 }}
            notFoundContent="There seems to be no other semesters in this organization to clone to."
          >
            {organizationSemesters.map((semester) => (
              <Select.Option key={semester.id} value={semester.id}>
                {`${semester.name} (${new Date(semester.startDate).toLocaleDateString()} - ${new Date(
                  semester.endDate,
                ).toLocaleDateString()})`}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      </Form>

      <Table
        dataSource={filteredCourses}
        columns={columns}
        rowKey="courseId"
        pagination={false}
      />
    </div>
  )
}

export default SelectCourses
