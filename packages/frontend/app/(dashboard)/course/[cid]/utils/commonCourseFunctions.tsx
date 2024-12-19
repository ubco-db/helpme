import { API } from '@/app/api'
import { message, Modal } from 'antd'
import { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { QueuePartial, UserPartial } from '@koh/common'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { orderBy } from 'lodash'

export async function checkInTA(
  courseId: number,
  queueId: number,
  mutateCourse: () => void,
  router: AppRouterInstance,
) {
  await API.taStatus
    .checkMeIn(courseId, queueId)
    .then((response) => {
      mutateCourse()
      router.push(`/course/${courseId}/queue/${response.id}`)
    })
    .catch((err) => {
      const errorMessage = getErrorMessage(err)
      message.error(errorMessage)
    })
}

export function isCheckedIn(
  staffList: UserPartial[] | undefined,
  userId: number,
) {
  return staffList?.some((user) => user.id === userId)
}

const { confirm } = Modal
export function confirmDisable(
  queueId: number,
  queue: { room: string } | undefined,
  router?: AppRouterInstance,
  redirectURL?: string,
) {
  if (!queue) {
    return
  }
  confirm({
    title: `Please Confirm!`,
    icon: <ExclamationCircleOutlined />,
    className: 'whitespace-pre-wrap',
    content: `Please confirm that you want to disable the queue: ${queue.room}.\n\nThis queue will no longer appear in the app, and any students currently in the queue will be removed.`,
    onOk() {
      disableQueue(queueId, queue, router, redirectURL)
    },
  })
}

export async function disableQueue(
  queueId: number,
  queue: { room: string },
  router?: AppRouterInstance,
  redirectURL?: string,
) {
  await API.queues
    .disable(queueId)
    .then(() => {
      message.success('Successfully disabled queue: ' + queue.room)
      // redirect to course page
      if (router && redirectURL) {
        router.push(redirectURL)
      }
    })
    .catch((err) => {
      const errorMessage = getErrorMessage(err)
      message.error('Unable to disable queue: ' + errorMessage)
    })
}

export async function clearQueue(
  queueId: number,
  queue: { room: string } | undefined,
) {
  if (!queue) {
    return
  }
  await API.queues
    .clean(queueId)
    .then(() => {
      message.success('Successfully cleaned queue: ' + queue.room)
    })
    .catch((err) => {
      const errorMessage = getErrorMessage(err)
      message.error('Unable to clean queue: ' + errorMessage)
    })
}

export function sortQueues(queues: QueuePartial[]) {
  return orderBy(
    queues,
    [
      'staffList.length',
      'isProfessorQueue',
      (queue) => queue.room.toLowerCase(),
    ],
    ['desc', 'desc', 'asc'],
  )
}
