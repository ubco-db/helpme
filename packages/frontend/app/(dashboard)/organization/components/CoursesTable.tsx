'use client'

import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import { SearchOutlined } from '@ant-design/icons'
import { CourseResponse, GetOrganizationResponse } from '@koh/common'
import { Button, Checkbox, Col, Input, Row, Tag, Table } from 'antd'
import { ColumnsType } from 'antd/es/table'
import { useEffect, useState } from 'react'
import useSWR, { mutate } from 'swr'
import BatchCourseCloneModal from './BatchCourseCloneModal'
import { organizationApi } from '@/app/api/organizationApi'
import { formatDateAndTimeForExcel } from '@/app/utils/timeFormatUtils'
import CenteredSpinner from '@/app/components/CenteredSpinner'
import SemesterInfoPopover from '../../components/SemesterInfoPopover'

const CoursesTable: React.FC = () => {
  const { userInfo } = useUserInfo()
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [showIds, setShowIds] = useState(true)
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
        1,
        search,
      ),
  )

  const columns: ColumnsType<CourseResponse> = [
    showIds && {
      title: 'Course ID',
      dataIndex: 'courseId',
      key: 'courseId',
    },
    {
      title: 'Course Name',
      dataIndex: 'courseName',
      key: 'courseName',
    },
    {
      title: 'Semester',
      dataIndex: 'semester',
      key: 'semester',
      render: (semester: any) => {
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
    !organization?.ssoEnabled && {
      title: 'Status',
      dataIndex: 'isEnabled',
      key: 'status',
      render: (isEnabled: boolean) => {
        return !isEnabled ? <Tag color="red">Archived</Tag> : null
      },
    },
    {
      title: 'Total Students',
      dataIndex: 'totalStudents',
      key: 'totalStudents',
    },
    {
      title: 'Date Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (createdAt: Date) => {
        if (!createdAt) return '-'
        const date = formatDateAndTimeForExcel(createdAt)
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
  ].filter(Boolean) as ColumnsType<CourseResponse>

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
              <Col>
                <Checkbox
                  checked={showIds}
                  onChange={() => setShowIds((prev) => !prev)}
                >
                  Show IDs
                </Checkbox>
              </Col>
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
            pagination={{
              pageSize: 10,
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
