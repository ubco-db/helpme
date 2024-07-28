/* eslint-disable react-hooks/exhaustive-deps */
'use client'

import { API } from '@/app/api'
import {
  GetOrganizationResponse,
  OrganizationCourseResponse,
  User,
} from '@koh/common'
import { Card, Spin } from 'antd'
import { useEffect, useState } from 'react'
import EditCourseForm from './EditCourseForm'
import ArchiveCourse from './ArchiveCourse'

type EditCourseProps = {
  courseId: number
  organization: GetOrganizationResponse
  user: User
}

const EditCourse: React.FC<EditCourseProps> = ({
  courseId,
  organization,
  user,
}) => {
  const [courseData, setCourseData] = useState<OrganizationCourseResponse>()

  const fetchCourseData = async () => {
    const response: OrganizationCourseResponse =
      await API.organizations.getCourse(organization.id, courseId)
    setCourseData(response)
  }

  useEffect(() => {
    fetchCourseData()
  }, [])

  return courseData ? (
    <div className="space-y-5">
      <Card bordered={true} title="Edit Course">
        <EditCourseForm
          courseData={courseData}
          organization={organization}
          fetchCourseData={fetchCourseData}
          user={user}
        />
      </Card>

      <Card
        bordered={true}
        title="Danger Zone"
        className="border-2 border-rose-500/[.35]"
      >
        <ArchiveCourse
          courseData={courseData}
          organization={organization}
          fetchCourseData={fetchCourseData}
        />
      </Card>
    </div>
  ) : (
    <Spin />
  )
}

export default EditCourse
