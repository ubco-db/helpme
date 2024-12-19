import { UserPartial } from '@koh/common'
import useSWR from 'swr'
import { API } from '../api'
import { useEffect, useMemo } from 'react'
import { debounce } from 'lodash'

/*
    This hook will call mutate for useSWR on the alerts data endpoint
    whenever the last staff member checks out of a queue (only for students).
*/
export function useUpdateAlertsWhenLastStaffChecksOut(
  courseId: number,
  staffList: undefined | UserPartial[],
  isStaff: boolean,
): void {
  const { mutate: mutateAlerts } = useSWR('/api/v1/alerts', async () =>
    API.alerts.get(courseId),
  )

  const debouncedMutateAlerts = useMemo(
    () => debounce(mutateAlerts, 1000),
    [mutateAlerts],
  )

  useEffect(() => {
    if (!isStaff && staffList?.length === 0) {
      debouncedMutateAlerts()
    }
  }, [staffList, isStaff, debouncedMutateAlerts])
}
