'use client'

import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import { SearchOutlined } from '@ant-design/icons'
import { CourseResponse, GetOrganizationResponse } from '@koh/common'
import { Button, Col, Input, List, Pagination, Row, Space, Tag } from 'antd'
import { useEffect, useState } from 'react'
import useSWR, { mutate } from 'swr'
import BatchCourseCloneModal from './BatchCourseCloneModal'
import { organizationApi } from '@/app/api/organizationApi'
import CenteredSpinner from '@/app/components/CenteredSpinner'

const CoursesTable: React.FC = () => {
  const { userInfo } = useUserInfo()

  const [page, setPage] = useState(1)
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
    setPage(1)
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

  useEffect(() => {
    return () => {
      // Clear the cache for the "CoursesTab" component
      mutate(`courses/${page}/${search}`)
    }
  }, [page, search])

  const { data: courses } = useSWR(
    `courses/${page}/${search}`,
    async () =>
      await API.organizations.getCourses(
        userInfo?.organization?.orgId ?? -1,
        page,
        search,
      ),
  )

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
            <Col className="flex gap-2" flex="none">
              <Button type="primary" href={`/organization/course/add`}>
                Add New Course
              </Button>
              <Button type="primary" onClick={() => setIsCloneModalOpen(true)}>
                Batch Clone Courses
              </Button>
            </Col>
          </Row>

          <List
            style={{ marginTop: 20 }}
            dataSource={courses}
            renderItem={(item: CourseResponse) => (
              <>
                <List.Item
                  style={{ borderBottom: '1px solid #f0f0f0', padding: 10 }}
                  key={item.courseId}
                  actions={[
                    <Button
                      key=""
                      type="primary"
                      href={`/organization/course/${item.courseId}/edit`}
                    >
                      Edit
                    </Button>,
                  ]}
                >
                  <List.Item.Meta title={item.courseName} />
                  {!item.isEnabled && <Tag color="red">Archived</Tag>}
                </List.Item>
              </>
            )}
          />
        </div>
        {courses.length > 50 && (
          <Pagination
            className="float-right"
            current={page}
            pageSize={50}
            total={courses.length}
            onChange={(page) => setPage(page)}
            showSizeChanger={false}
          />
        )}
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
