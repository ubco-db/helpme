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
        {/* <div className="flex flex-col items-center md:flex-row">
          <div className="mb-2 w-full md:mr-4 md:w-5/6 md:text-left">
            <strong>
              {userData.user.accountDeactivated
                ? 'Reactivate this account'
                : 'Deactivate this account'}
            </strong>
            <div className="mb-0">
              {userData.user.accountDeactivated
                ? 'Once you reactivate an account, the user will be able to access organization resources.'
                : 'Once you deactivate an account, the user will not be able to access organization resources.'}
            </div>
          </div>
          <Button
            danger
            className="w-full md:w-auto"
            onClick={updateAccess}
          >
            {userData.user.accountDeactivated
              ? 'Reactivate this account'
              : 'Deactivate this account'}
          </Button>
        </div>

        <div className="mt-2 flex flex-col items-center md:flex-row">
          <div className="mb-2 w-full md:mr-4 md:w-5/6 md:text-left">
            <strong>Delete profile picture</strong>
            <div className="mb-0">
              This will delete the user&lsquo;s profile picture.
            </div>
          </div>
          <Button
            danger
            className="w-full md:w-auto"
            disabled={!userData.user.photoUrl}
            onClick={deleteProfilePicture}
          >
            Delete profile picture
          </Button>
        </div> */}
      </Card>
    </div>
  ) : (
    <Spin />
  )
}

export default OrganizationEditUser
