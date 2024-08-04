import { API } from '@/app/api'
import { useCourse } from '@/app/hooks/useCourse'
import { useMediaQuery } from '@/app/hooks/useMediaQuery'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import { UserCourse } from '@koh/common'
import { Button, message, Modal, Table, TableColumnsType } from 'antd'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'

const { confirm } = Modal

const CoursePreference: React.FC = () => {
  const router = useRouter()
  const { data: profile, mutate } = useSWR(`api/v1/profile`, async () =>
    API.profile.index(),
  )

  const isMobile = useMediaQuery('(max-width: 768px)')

  async function withdraw(course: UserCourse) {
    await API.course.withdrawCourse(course.course.id)
    message.success('Successfully withdrew from ' + course.course.name)
    await mutate()
    router.push('/')
  }

  function showConfirm(courseId: number) {
    const course = profile?.courses.find((c) => c.course.id === courseId)

    confirm({
      title: `Please Confirm!`,
      icon: <ExclamationCircleOutlined />,
      content: `Please confirm that you want to unenroll from ${
        course?.course.name
      } as a ${
        course?.role ? formattedRoles[course.role] : ''
      }.  The only way to get back is by contacting a professor!`,
      onOk() {
        withdraw(course as UserCourse)
      },
    })
  }

  const InstructorCell = ({ courseId }: { courseId: number }) => {
    const course = useCourse(courseId)

    return <>{course.course?.coordinator_email}</>
  }

  const columns: TableColumnsType = [
    {
      title: 'Course name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
    },
    {
      title: 'Instructor',
      dataIndex: 'instructor',
      key: 'instructor',
      render: function createInstructorCell(courseId: number) {
        return <InstructorCell courseId={courseId} />
      },
    },
    {
      title: '',
      align: 'right',
      key: 'courseId',
      dataIndex: 'courseId',
      render: function withdrawButton(courseId: number) {
        return (
          <Button
            type="primary"
            shape="round"
            onClick={() => {
              showConfirm(courseId)
            }}
            danger
          >
            Withdraw
          </Button>
        )
      },
    },
  ]

  function createCourseDataSource() {
    return profile?.courses.map((c) => ({
      key: c.course.id,
      name: c.course.name,
      role: formattedRoles[c.role],
      instructor: c.course.id,
      courseId: c.course.id,
    }))
  }

  const formattedRoles = {
    student: 'Student',
    ta: 'TA',
    professor: 'Professor',
  }

  return (
    profile && (
      <div>
        <Table
          columns={columns}
          size={isMobile ? 'small' : 'large'}
          dataSource={createCourseDataSource()}
        />
      </div>
    )
  )
}

export default CoursePreference
