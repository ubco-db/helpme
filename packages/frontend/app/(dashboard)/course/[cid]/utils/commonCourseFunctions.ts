import { API } from '@/app/api'
import { message } from 'antd'
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { QueuePartial, UserPartial } from '@koh/common'

export async function checkInTA(
  courseId: number,
  room: string,
  mutateCourse: () => void,
  router: AppRouterInstance,
) {
  await API.taStatus
    .checkIn(courseId, room)
    .then((response) => {
      mutateCourse()
      // 5 hrs before checking a TA out
      // Note: this timer is old code. It seems weird to check the TA out on the client-side since this will never finish if the user navigates away from the page.
      // It does seem like the TA eventually gets checked out, but it's unclear if this function is what causes it.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const checkoutTimer = setTimeout(
        async () => {
          message.warning('You are checked out automatically after 5 hours')
          await API.taStatus.checkOut(courseId, room)
          mutateCourse()
        },
        1000 * 60 * 60 * 5,
      )
      router.push(`/course/${courseId}/queue/${response.id}`)
    })
    .catch((err) => {
      message.error(err.response?.data?.message)
    })
}

export function isCheckedIn(
  staffList: UserPartial[] | undefined,
  userId: number,
) {
  return staffList?.some((user) => user.id === userId)
}
