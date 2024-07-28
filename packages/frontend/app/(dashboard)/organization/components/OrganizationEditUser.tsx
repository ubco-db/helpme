/* eslint-disable react-hooks/exhaustive-deps */
'use client'

import { Card, Spin } from 'antd'
import OrganizationEditUserGeneralForm from './OrganizationEditUserGeneralForm'
import {
  GetOrganizationResponse,
  GetOrganizationUserResponse,
} from '@koh/common'
import OrganizationEditUserCoursesForm from './OrganizationEditUserCoursesForm'
import { API } from '@/app/api'
import { useEffect, useState } from 'react'
import OrganizationEditUserDangerZoneForm from './OrganizationEditUserDangerZoneForm'

type OrganizationEditUserProps = {
  userId: number
  organization: GetOrganizationResponse
}

const OrganizationEditUser: React.FC<OrganizationEditUserProps> = ({
  userId,
  organization,
}) => {
  const [userData, setUserData] = useState<GetOrganizationUserResponse>()

  const fetchUserData = async () => {
    const response: GetOrganizationUserResponse = await API.organizations
      .getUser(organization.id, userId)
      .then((userInfo) => {
        userInfo.courses = userInfo?.courses.map((course) => {
          return {
            ...course,
            key: course.id,
          }
        })
        return userInfo
      })

    setUserData(response)
  }

  useEffect(() => {
    fetchUserData()
  }, [])

  return userData ? (
    <div className="space-y-5">
      <Card bordered={true} title="General">
        <OrganizationEditUserGeneralForm
          userData={userData}
          organization={organization}
          fetchUserData={fetchUserData}
        />
      </Card>

      <Card bordered={true} title="Courses Information">
        <OrganizationEditUserCoursesForm
          userData={userData}
          organization={organization}
          fetchUserData={fetchUserData}
        />
      </Card>

      <Card
        bordered={true}
        title="Danger Zone"
        className="border-2 border-rose-500/[.35]"
      >
        <OrganizationEditUserDangerZoneForm
          userData={userData}
          organization={organization}
          fetchUserData={fetchUserData}
        />
      </Card>
    </div>
  ) : (
    <Spin />
  )
}

export default OrganizationEditUser
