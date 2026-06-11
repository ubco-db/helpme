import { Role } from '@koh/common'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import TACheckinButton from './TACheckinButton'
import CheckInModal from './CheckInModal'
import { useUserInfo } from '@/app/contexts/userContext'
import { useCourse } from '@/app/hooks/useCourse'
import { getRoleInCourse } from '@/app/utils/generalUtils'
import { checkInTA } from '../utils/commonCourseFunctions'

interface CoursePageCheckInButtonProps {
  courseId: number
}

const CoursePageCheckInButton: React.FC<CoursePageCheckInButtonProps> = ({
  courseId,
}) => {
  // state for check in modal
  const [checkInModalVisible, setCheckInModalVisible] = useState(false)

  const { userInfo } = useUserInfo()
  const router = useRouter()
  const { course, mutateCourse } = useCourse(courseId)
  const role = getRoleInCourse(userInfo, courseId)
  const availableQueues =
    course?.queues?.filter((q) =>
      role === Role.TA ? !q.isProfessorQueue : true,
    ) ?? []
  const queueCheckedIn = course?.queues?.find((queue) =>
    queue.staffList.find((staff) => staff.id === userInfo?.id),
  )
  const numQueues = course?.queues?.length ?? 0

  return (
    <>
      {checkInModalVisible && (
        <CheckInModal
          visible={checkInModalVisible}
          onSubmit={async (queueId: number) => {
            checkInTA(courseId, queueId, mutateCourse, router)
          }}
          onCancel={() => setCheckInModalVisible(false)}
          queues={availableQueues}
        />
      )}
      {role !== Role.STUDENT && numQueues !== 0 && (
        <>
          {queueCheckedIn ? (
            <TACheckinButton
              courseId={courseId}
              state="CheckedIn"
              className="w-fit"
            />
          ) : (
            <TACheckinButton
              courseId={courseId}
              state="CheckedOut"
              className="w-fit"
              preventDefaultAction={true}
              onClick={() => {
                setCheckInModalVisible(true)
              }}
            />
          )}
        </>
      )}
    </>
  )
}

export default CoursePageCheckInButton
