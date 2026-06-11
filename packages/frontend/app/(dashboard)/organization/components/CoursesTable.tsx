'use client'

import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import { SearchOutlined } from '@ant-design/icons'
import {
  CourseResponse,
  GetOrganizationResponse,
  SemesterPartial,
} from '@koh/common'
import { Button, Checkbox, Col, Input, Row, Tag, Table } from 'antd'
import { ColumnsType } from 'antd/es/table'
import type { SortOrder } from 'antd/es/table/interface'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import BatchCourseCloneModal from './BatchCourseCloneModal'
import { organizationApi } from '@/app/api/organizationApi'
import { formatDateAndTimeForExcel } from '@/app/utils/timeFormatUtils'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import SemesterInfoPopover from '../../components/SemesterInfoPopover'

const CoursesTable: React.FC = () => {
  const { userInfo } = useUserInfo()
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [organization, setOrganization] = useState<GetOrganizationResponse>()

  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false)

  const handleInput = (event: any) => {
    event.preventDefault()
    setInput(event.target.value)
  }

  const handleSearch = (event: any) => {
    event.preventDefault()
    setSearch(event.target.value)
  }

  useEffect(() => {
    const fetchOrganization = async () => {
      if (!userInfo.organization?.orgId) {
        return
      }

      await organizationApi
        .getOrganization(userInfo.organization.orgId)
        .then((res) => {
          setOrganization(res)
        })
    }
    fetchOrganization()
  }, [userInfo.organization?.orgId])

  const { data: courses } = useSWR(
    `courses/${search}`,
    async () =>
      await API.organizations.getCourses(
        userInfo?.organization?.orgId ?? -1,
        undefined,
        search,
      ),
  )

  const getDateValue = (value?: Date | string | null): number | null => {
    if (!value) return null
    const dateValue = typeof value === 'string' ? new Date(value) : value
    const time = dateValue.getTime()
    return Number.isNaN(time) ? null : time
  }

  const getSemesterEndTime = (
    semester?: SemesterPartial | null,
  ): number | null => {
    if (!semester) return null
    if (semester.name === 'Legacy Semester') return null
    return getDateValue(semester.endDate ?? null)
  }

  const compareSemesters = (
    a: CourseResponse,
    b: CourseResponse,
    sortOrder?: SortOrder,
  ): number => {
    const order: SortOrder = sortOrder === 'descend' ? 'descend' : 'ascend'
    const aTime = getSemesterEndTime(a.semester)
    const bTime = getSemesterEndTime(b.semester)
    const aIsNull = aTime === null
    const bIsNull = bTime === null

    const desiredCompare = () => {
      if (aIsNull && bIsNull) return 0
      if (aIsNull) return -1
      if (bIsNull) return 1
      return order === 'ascend' ? aTime - bTime : bTime - aTime
    }

    const result = desiredCompare()
    return order === 'ascend' ? result : -result
  }

  const columns: ColumnsType<CourseResponse> = [
    {
      title: 'Course ID',
      dataIndex: 'courseId',
      key: 'courseId',
      sorter: (a: CourseResponse, b: CourseResponse) =>
        (a.courseId ?? 0) - (b.courseId ?? 0),
    },
    {
      title: 'Course Name',
      dataIndex: 'courseName',
      key: 'courseName',
      sorter: (a: CourseResponse, b: CourseResponse) => {
        const A = a.courseName || ''
        const B = b.courseName || ''
        return A.localeCompare(B)
      },
      render: (name: string, record: CourseResponse) => (
        <div className="flex items-center gap-2">
          {name}
          <span className="text-gray-500">{` ${record.sectionGroupName}`}</span>
          {!record.isEnabled && <Tag color="red">Archived</Tag>}
        </div>
      ),
    },
    {
      title: 'Semester',
      dataIndex: 'semester',
      key: 'semester',
      defaultSortOrder: 'descend',
      sorter: compareSemesters,
      render: (semester: SemesterPartial) => {
        if (!semester) return null
        return (
          <SemesterInfoPopover semester={semester}>
            <Tag color={semester.color} bordered={false} className="text-sm">
              {semester.name === 'Legacy Semester'
                ? 'No Semester'
                : semester.name}
            </Tag>
          </SemesterInfoPopover>
        )
      },
    },
    {
      title: 'Total Students',
      dataIndex: 'totalStudents',
      key: 'totalStudents',
      sorter: (a: CourseResponse, b: CourseResponse) =>
        (a.totalStudents ?? 0) - (b.totalStudents ?? 0),
    },
    {
      title: 'Date Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: (a: CourseResponse, b: CourseResponse) => {
        const A = getDateValue(a.createdAt) ?? 0
        const B = getDateValue(b.createdAt) ?? 0
        return A - B
      },
      render: (createdAt: Date | string) => {
        if (!createdAt) return '-'
        const dateValue =
          typeof createdAt === 'string' ? new Date(createdAt) : createdAt
        const date = formatDateAndTimeForExcel(dateValue)
        return date.split(' ')[0] // YYYY-MM-DD
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: CourseResponse) => (
        <Button
          type="primary"
          href={`/organization/course/${record.courseId}/edit`}
        >
          Edit
        </Button>
      ),
    },
  ]

  if (!organization) {
    return <CenteredSpinner tip="Fetching Organization Info..." />
  }

  return (
    userInfo &&
    courses && (
      <>
        <div className="bg-white">
          <Row justify="space-between" align="middle" wrap>
            <Col flex="auto" className="mr-2">
              <Input
                placeholder="Search Courses"
                prefix={<SearchOutlined />}
                value={input}
                onChange={handleInput}
                onPressEnter={handleSearch}
              />
            </Col>
            <Col className="flex items-center gap-2" flex="none">
              <Button type="primary" href={`/organization/course/add`}>
                Add New Course
              </Button>
              <Button type="primary" onClick={() => setIsCloneModalOpen(true)}>
                Batch Clone Courses
              </Button>
            </Col>
          </Row>

          <Table
            dataSource={courses}
            columns={columns}
            rowKey="courseId"
            className="mt-2"
            size="small"
            pagination={{
              pageSize: 30,
              showQuickJumper: true,
            }}
          />
        </div>
        <BatchCourseCloneModal
          open={isCloneModalOpen}
          onClose={() => setIsCloneModalOpen(false)}
          organization={organization}
        />
      </>
    )
  )
}

export default CoursesTable
