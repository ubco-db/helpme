import React from 'react'
import { Button, Collapse, Popover, Tag, Typography } from 'antd'
import { Role, SemesterPartial, UserCourse } from '@koh/common'
import Link from 'next/link'
import Table, { ColumnsType } from 'antd/es/table'

const { Panel } = Collapse
const { Text } = Typography

interface ArchivedCoursesProps {
  archivedCourses: UserCourse[]
  semesters: SemesterPartial[]
}

const columns: ColumnsType<UserCourse> = [
  {
    dataIndex: ['course', 'name'],
    key: 'name',
    width: '70%',
    align: 'left',
    render: (text: string, course: UserCourse) => (
      <span className="flex items-center text-lg font-semibold">
        {text}
        {course.course.sectionGroupName && (
          <span className="ml-1 text-sm text-gray-600">{`[${course.course.sectionGroupName}]`}</span>
        )}
      </span>
    ),
  },
  {
    dataIndex: 'semester',
    key: 'semester',
    width: '10%',
    align: 'center',
    render: (semester) => {
      const popoverContent = (
        <div className="p-2">
          <p>
            <strong>Start Date:</strong>{' '}
            {new Date(semester.startDate).toLocaleDateString()}
          </p>
          <p>
            <strong>End Date:</strong>{' '}
            {new Date(semester.endDate).toLocaleDateString()}
          </p>
          {semester.description && (
            <p>
              <strong>Description:</strong> {semester.description}
            </p>
          )}
        </div>
      )
      return (
        <Popover content={popoverContent} title={semester.name}>
          <Tag color="blue" className="text-base">
            {semester?.name ?? ''}
          </Tag>
        </Popover>
      )
    },
  },
  {
    dataIndex: 'role',
    key: 'role',
    width: '10%',
    align: 'center',
    render: (role) => (
      <Tag
        color={
          role === Role.STUDENT
            ? 'success'
            : role === Role.TA
              ? 'gold'
              : 'volcano'
        }
        className="text-base capitalize"
      >
        {role}
      </Tag>
    ),
  },
  {
    key: 'actions',
    width: '20%',
    align: 'center',
    render: (_, course) => (
      <div className="flex w-full flex-col items-end justify-center gap-2 md:flex-row md:items-center md:justify-end">
        <Link href={`/course/${course.course.id}`}>
          <Button
            type="primary"
            className="rounded text-sm md:p-[1.1rem] md:font-medium"
          >
            Course Page
          </Button>
        </Link>
        {course.role === Role.PROFESSOR && (
          <Link href={`/course/${course.course.id}/settings`}>
            <Button className="rounded p-[1.1rem] text-sm md:font-medium">
              Edit Course
            </Button>
          </Link>
        )}
      </div>
    ),
  },
]

const ArchivedCoursesSection: React.FC<ArchivedCoursesProps> = ({
  archivedCourses,
  semesters,
}) => {
  return (
    <Collapse className="mb-10 mt-16">
      <Panel header="Archived Courses" key="archived">
        <Table
          columns={columns}
          size="small"
          dataSource={archivedCourses
            .sort((a, b) => a.course.name.localeCompare(b.course.name))
            .map((userCourse) => {
              const semester = semesters.find(
                (s) => s.id === userCourse.course.semesterId,
              )
              return { ...userCourse, semester }
            })}
          rowKey={(userCourse: UserCourse) => userCourse.course.id}
          pagination={archivedCourses.length > 5 ? { pageSize: 5 } : false}
          showHeader={false}
        />
      </Panel>
    </Collapse>
  )
}

export default ArchivedCoursesSection
