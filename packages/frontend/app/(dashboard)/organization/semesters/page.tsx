'use client'

import { ReactNode, useEffect, useMemo, useState } from 'react'
import { useUserInfo } from '@/app/contexts/userContext'
import { SemesterPartial } from '@koh/common'
import { SemesterManagement } from './components/SemesterManagement'
import { useOrganizationSettings } from '@/app/hooks/useOrganizationSettings'
import {
  checkCourseCreatePermissions,
  getErrorMessage,
} from '@/app/utils/generalUtils'
import { API } from '@/app/api'
import { message } from 'antd'
import CenteredSpinner from '@/app/components/CenteredSpinner'

export default function SemesterManagementPage(): ReactNode {
  const { userInfo } = useUserInfo()
  const organizationId = useMemo(
    () => Number(userInfo?.organization?.orgId) ?? -1,
    [userInfo?.organization?.orgId],
  )

  const [isSemestersLoading, setIsSemestersLoading] = useState(true)
  const [organizationSemesters, setOrganizationSemesters] = useState<
    SemesterPartial[]
  >([])
  const organizationSettings = useOrganizationSettings(organizationId)

  useEffect(() => {
    const fetchDataAsync = async () => {
      setIsSemestersLoading(true)
      await API.organizations
        .get(organizationId)
        .then((res) => {
          const semesters = res.semesters.map((s: SemesterPartial) => ({
            id: s.id,
            name: s.name,
            startDate: s.startDate ? new Date(s.startDate) : null,
            endDate: s.endDate ? new Date(s.endDate) : null,
            description: s.description,
            color: s.color,
          }))
          setOrganizationSemesters(semesters)
        })
        .catch((err) => {
          message.error('Failed to load semesters:' + getErrorMessage(err))
        })
        .finally(() => {
          setIsSemestersLoading(false)
        })
    }
    if (organizationId > 0) {
      fetchDataAsync()
    }
  }, [organizationId])

  return (
    <div className="flex flex-col items-center gap-3">
      {isSemestersLoading ? (
        <CenteredSpinner tip="Loading Semesters..." />
      ) : checkCourseCreatePermissions(userInfo, organizationSettings) ? (
        <SemesterManagement
          orgId={organizationId}
          organizationSemesters={organizationSemesters}
          setOrganizationSemesters={setOrganizationSemesters}
        />
      ) : (
        <p className="text-muted-foreground text-center">
          You do not have permission to create or manage semesters. Please
          contact an admin for the semester you are looking to create or manage.
        </p>
      )}
    </div>
  )
}
