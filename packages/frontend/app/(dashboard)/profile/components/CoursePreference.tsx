import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import { useCourse } from '@/app/hooks/useCourse'
import { useMediaQuery } from '@/app/hooks/useMediaQuery'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import { UserCourse } from '@koh/common'
import { Button, message, Modal, Table, TableColumnsType } from 'antd'
import useSWR from 'swr'

const { confirm } = Modal

const CoursePreference: React.FC = () => {
  const { userInfo, setUserInfo } = useUserInfo()
  const isMobile = useMediaQuery('(max-width: 768px)')

  async function withdraw(course: UserCourse) {
    await API.course
      .withdrawCourse(course.course.id)
      .then(async (res) => {
        message.success('Successfully withdrew from ' + course.course.name)
        setUserInfo({
          ...userInfo,
          courses: userInfo.courses.filter(
            (c) => c.course.id !== course.course.id,
          ),
        })
      })
      .catch((e) => {
        const errorMessage = getErrorMessage(e)
        message.error(
          `Failed to withdraw from ${course.course.name}: ${errorMessage}`,
        )
      })
  }

  function showConfirm(courseId: number) {
    const course = userInfo?.courses.find((c) => c.course.id === courseId)
    if (!course) {
      return
    }
    confirm({
      title: `Please Confirm!`,
      icon: <ExclamationCircleOutlined />,
      content: `Please confirm that you want to unenroll from ${
        course.course.name
      } as a ${
        formattedRoles[course.role]
      }.  The only way to get back is by contacting a professor!`,
      onOk() {
        withdraw(course)
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
    return userInfo?.courses.map((c) => ({
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
    userInfo && (
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
