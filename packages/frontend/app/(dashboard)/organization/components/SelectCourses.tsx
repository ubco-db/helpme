import { CourseResponse, SemesterPartial } from '@koh/common'
import { Checkbox, Form, Select, Table } from 'antd'
import { ColumnsType } from 'antd/es/table'
import { CheckboxChangeEvent } from 'antd/lib'
import { useState } from 'react'

type SelectCoursesProps = {
  courses: CourseResponse[]
  selectedCourseIds: number[]
  setSelectedCourseIds: (selectedCourses: number[]) => void
  organizationSemesters: SemesterPartial[]
}

const SelectCourses: React.FC<SelectCoursesProps> = ({
  courses,
  selectedCourseIds: selectedCourses,
  setSelectedCourseIds: setSelectedCourses,
  organizationSemesters,
}) => {
  const [filterSemesterId, setFilterSemesterId] = useState<number | null>(null)

  // Filter courses based on the selected semester filter
  const filteredCourses = courses.filter(
    (course) =>
      filterSemesterId === null || course.semesterId === filterSemesterId,
  )

  // Check if all filtered courses are selected
  const allSelected = filteredCourses.every((course) =>
    selectedCourses.includes(course.courseId),
  )

  // Toggle select all for filtered list
  const toggleSelectAll = (e: CheckboxChangeEvent) => {
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
  const columns: ColumnsType<CourseResponse> = [
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
        organizationSemesters.find((s) => s.id === semesterId)?.name ||
        'Not Assigned',
    },
    {
      title: <Checkbox checked={allSelected} onChange={toggleSelectAll} />,
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
            notFoundContent="There are currently no semesters in your organization to filter by."
          >
            <Select.Option key={-1} value={null}>
              {`All Semesters`}
            </Select.Option>
            {organizationSemesters.map((semester) => (
              <Select.Option key={semester.id} value={semester.id}>
                {`${semester.name} (${
                  semester.startDate
                    ? new Date(semester.startDate).toLocaleDateString()
                    : '—'
                } - ${
                  semester.endDate
                    ? new Date(semester.endDate).toLocaleDateString()
                    : '—'
                })`}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      </Form>

      <Table
        dataSource={filteredCourses}
        columns={columns}
        rowKey="courseId"
        pagination={{
          pageSize: 10,
          showQuickJumper: true,
        }}
      />
    </div>
  )
}

export default SelectCourses
