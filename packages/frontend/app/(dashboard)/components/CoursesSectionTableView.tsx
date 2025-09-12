import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import { getErrorMessage, cn } from '@/app/utils/generalUtils'
import { UserCourse, Role } from '@/middlewareType'
import { StarFilled, StarOutlined } from '@ant-design/icons'
import { SemesterPartial } from '@koh/common'
import { message, Tag, Button, Popover, Divider, Table, Tooltip } from 'antd'
import { ColumnsType } from 'antd/es/table'
import Link from 'next/link'
import { useMemo } from 'react'

interface CoursesSectionTableViewProps {
  semesters: SemesterPartial[]
}

const CoursesSectionTableView: React.FC<CoursesSectionTableViewProps> = ({
  semesters,
}) => {
  const { userInfo, setUserInfo } = useUserInfo()

  // Updated toggleFavourite function to use API object
  const toggleFavourite = (course: UserCourse) => {
    const newStatus = !course.favourited
    // immediately set local userInfo state so the UI is updated immediately
    setUserInfo((prev) => ({
      ...prev,
      courses: prev.courses.map((c) =>
        c.course.id === course.course.id ? { ...c, favourited: newStatus } : c,
      ),
    }))
    // now update in the background
    API.course
      .toggleFavourited(course.course.id)
      .then(() => {
        setUserInfo((prev) => ({
          ...prev,
          courses: prev.courses.map((c) =>
            c.course.id === course.course.id
              ? { ...c, favourited: newStatus }
              : c,
          ),
        }))
      })
      .catch((err) => {
        // revert local userInfo state if API call fails
        setUserInfo((prev) => ({
          ...prev,
          courses: prev.courses.map((c) =>
            c.course.id === course.course.id
              ? { ...c, favourited: !newStatus }
              : c,
          ),
        }))
        message.error(getErrorMessage(err))
      })
  }

  // Allow recalculation for course favouriting feature (harder to memoize)
  const coursesWithoutSemester = useMemo(() => {
    return userInfo.courses.filter((userCourse) => {
      return !semesters?.some(
        (semester) => semester.id === userCourse.course.semesterId,
      )
    })
  }, [userInfo.courses, semesters])

  const columns: ColumnsType<UserCourse> = [
    {
      key: 'favourite',
      width: '5%',
      align: 'center',
      className: 'p-0 md:p-1',
      render: (_, course) => (
        <Tooltip
          title={
            course.favourited
              ? 'Unfavourite this course to remove it from your dashboard (Card View)'
              : 'Favourite this course to add it to your dashboard (Card View)'
          }
          mouseEnterDelay={0.5}
        >
          <button
            className={cn(
              `h-6 w-full`,
              course.favourited
                ? 'text-yellow-400 hover:text-yellow-500'
                : 'text-gray-400 hover:text-gray-600',
            )}
            onClick={() => toggleFavourite(course)}
          >
            {course.favourited ? <StarFilled /> : <StarOutlined />}
          </button>
        </Tooltip>
      ),
    },
    {
      dataIndex: ['course', 'name'],
      key: 'name',
      width: '70%',
      align: 'left',
      render: (text, course) => (
        <Link
          href={`/course/${course.course.id}`}
          className="flex items-center text-base font-semibold hover:opacity-80 focus:opacity-80"
        >
          {text}
          {course.course.sectionGroupName && (
            <span className="ml-1 text-sm text-blue-700/50">{`${course.course.sectionGroupName}`}</span>
          )}
        </Link>
      ),
    },
    {
      dataIndex: 'role',
      key: 'role',
      width: '10%',
      align: 'center',
      className: 'px-0 md:px-1',
      render: (role) => (
        <Tag
          color={
            role === Role.STUDENT
              ? 'success'
              : role === Role.TA
                ? 'gold'
                : 'blue'
          }
          className="text-sm capitalize"
        >
          {role}
        </Tag>
      ),
    },
    {
      key: 'actions',
      width: '10%',
      align: 'center',
      className: 'pl-0 md:pl-1',
      render: (_, course) => (
        <div className="flex w-full flex-col items-end justify-center gap-2 md:flex-row md:items-center md:justify-end">
          {course.role === Role.PROFESSOR && (
            <Link href={`/course/${course.course.id}/settings`}>
              <Button className="">
                <span>
                  Edit<span className="hidden md:inline"> Course</span>
                </span>
              </Button>
            </Link>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      {semesters
        ?.sort((a, b) => {
          const aTime = a.startDate
            ? new Date(a.startDate).getTime()
            : -Infinity
          const bTime = b.startDate
            ? new Date(b.startDate).getTime()
            : -Infinity
          return bTime - aTime
        })
        .map((semester) => {
          const semesterCourses = userInfo.courses.filter(
            (userCourse) => userCourse.course.semesterId === semester.id,
          )
          if (semesterCourses.length === 0) {
            return null
          }

          const popoverContent = (
            <div className="max-w-60 p-2">
              <p>
                <strong>Start Date:</strong>{' '}
                {semester.startDate
                  ? new Date(semester.startDate).toLocaleDateString()
                  : '—'}
              </p>
              <p>
                <strong>End Date:</strong>{' '}
                {semester.endDate
                  ? new Date(semester.endDate).toLocaleDateString()
                  : '—'}
              </p>
              {semester.description && (
                <p>
                  <strong>Description:</strong> {semester.description}
                </p>
              )}
            </div>
          )

          return (
            <div key={semester.id}>
              <Popover content={popoverContent} title={semester.name}>
                <Divider className="my-0.5 text-base font-semibold md:py-1 md:text-lg">
                  {semester.name}
                </Divider>
              </Popover>
              <Table
                columns={columns}
                size="small"
                dataSource={semesterCourses
                  .filter((userCourse) => userCourse.course.enabled)
                  .sort((a, b) => a.course.name.localeCompare(b.course.name))}
                rowKey={(course) => course.course.id}
                pagination={false}
                showHeader={false}
              />
            </div>
          )
        })}

      {coursesWithoutSemester.length > 0 && (
        <div key={-1}>
          <Divider className="m-0 text-base font-semibold md:my-0.5 md:py-1 md:text-lg">
            <Tooltip title="These courses are not assigned to a semester">
              No Semester
            </Tooltip>
          </Divider>
          <Table
            columns={columns}
            size="small"
            dataSource={coursesWithoutSemester.sort((a, b) =>
              a.course.name.localeCompare(b.course.name),
            )}
            rowKey={(course) => course.course.id}
            pagination={false}
            showHeader={false}
          />
        </div>
      )}
    </>
  )
}

export default CoursesSectionTableView
