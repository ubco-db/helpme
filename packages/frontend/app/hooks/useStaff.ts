import { API } from '@/app/api'
import { UserPartial } from '@koh/common'
import { useState, useEffect } from 'react'

export function useStaff(courseId: number): UserPartial[] | null {
  const [staff, setStaff] = useState<UserPartial[] | null>(null)

  useEffect(() => {
    const fetchStaff = async () => {
      const data = await API.course.getUserInfo(courseId, 1, 'staff')
      // sort staff by name
      data.users.sort((a, b) => {
        if (!a.name || !b.name) {
          return 0
        } else {
          return a.name.localeCompare(b.name)
        }
      })
      setStaff(data.users)
    }
    fetchStaff()
  }, [courseId])

  return staff
}
