'use client'

import { ReactNode, useEffect, useMemo, useState } from 'react'
import { useUserInfo } from '@/app/contexts/userContext'
import { SemesterPartial } from '@koh/common'
import { SemesterManagement } from './components/SemesterManagement'
import { useOrganizationSettings } from '@/app/hooks/useOrganizationSettings'
import { checkCourseCreatePermissions } from '@/app/utils/generalUtils'
import { API } from '@/app/api'

export default function SemesterManagementPage(): ReactNode {
  const { userInfo } = useUserInfo()
  const organizationId = useMemo(
    () => Number(userInfo?.organization?.orgId) ?? -1,
    [userInfo?.organization?.orgId],
  )

  const [organizationSemesters, setOrganizationSemesters] = useState<
    SemesterPartial[]
  >([])
  const organizationSettings = useOrganizationSettings(organizationId)

  useEffect(() => {
    const fetchDataAsync = async () => {
      const response = await API.organizations.get(organizationId)
      const semesters = response.semesters.map((s: SemesterPartial) => ({
        id: s.id,
        name: s.name,
        startDate: s.startDate ? new Date(s.startDate) : null,
        endDate: s.endDate ? new Date(s.endDate) : null,
        description: s.description,
        color: s.color,
      }))

      setOrganizationSemesters(semesters)
    }
    if (organizationId > 0) {
      fetchDataAsync()
    }
  }, [organizationId])

  return (
    <div className="flex flex-col items-center gap-3">
      {checkCourseCreatePermissions(userInfo, organizationSettings) && (
        <SemesterManagement
          orgId={organizationId}
          organizationSemesters={organizationSemesters}
          setOrganizationSemesters={setOrganizationSemesters}
        />
      )}
    </div>
  )
}
