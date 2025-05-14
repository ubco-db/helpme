/* eslint-disable react-hooks/exhaustive-deps */
'use client'

import { Card, message, Spin } from 'antd'
import OrganizationEditUserGeneralForm from './OrganizationEditUserGeneralForm'
import {
  GetOrganizationResponse,
  GetOrganizationUserResponse,
} from '@koh/common'
import OrganizationEditUserCoursesForm from './OrganizationEditUserCoursesForm'
import { API } from '@/app/api'
import { useEffect, useState } from 'react'
import OrganizationEditUserDangerZoneForm from './OrganizationEditUserDangerZoneForm'
import { useRouter } from 'next/navigation'

type OrganizationEditUserProps = {
  userId: number
  organization: GetOrganizationResponse
}

const OrganizationEditUser: React.FC<OrganizationEditUserProps> = ({
  userId,
  organization,
}) => {
  const [userData, setUserData] = useState<GetOrganizationUserResponse>()
  const router = useRouter()

  const fetchUserData = async () => {
    const response: GetOrganizationUserResponse | null = await API.organizations
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
      .catch((error) => {
        message.error(error.response.data.message)

        setTimeout(() => {
          router.back()
        }, 1_500)
        return null
      })

    if (!response) return

    setUserData(response)
  }

  useEffect(() => {
    fetchUserData()
  }, [])

  return userData ? (
    <div className="space-y-5">
      <Card variant="outlined" title="General">
        <OrganizationEditUserGeneralForm
          userData={userData}
          organization={organization}
          fetchUserData={fetchUserData}
        />
      </Card>

      <Card variant="outlined" title="Courses Information">
        <OrganizationEditUserCoursesForm
          userData={userData}
          organization={organization}
          fetchUserData={fetchUserData}
        />
      </Card>

      <Card
        variant="outlined"
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
