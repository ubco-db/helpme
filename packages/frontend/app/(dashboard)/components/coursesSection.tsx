import { Role, SemesterPartial, UserCourse } from '@koh/common'
import {
  Button,
  Card,
  Divider,
  message,
  Popover,
  Table,
  Tag,
  Tooltip,
} from 'antd'
import React, { useMemo } from 'react'
import Meta from 'antd/es/card/Meta'
import Link from 'next/link'
import stringToHexColor, { getErrorMessage } from '@/app/utils/generalUtils'
import { ColumnsType } from 'antd/es/table'
import { StarFilled, StarOutlined } from '@ant-design/icons'
import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'

// TODO: remove all code for unassigned semesters when all production courses have new semesters set

interface CoursesSectionProps {
  semesters: SemesterPartial[]
  enabledTableView: boolean
}

const CoursesSection: React.FC<CoursesSectionProps> = ({
  semesters,
  enabledTableView,
}) => {
  // For some reason, jdenticon is not working when imported as a module and needs to use require
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const jdenticon = require('jdenticon')
  const iconSize = 60

  jdenticon.configure({
    hues: [200],
    lightness: {
      color: [0.4, 0.8],
      grayscale: [0.3, 0.9],
    },
    saturation: {
      color: 0.5,
      grayscale: 0.0,
    },
  })

  const { userInfo, setUserInfo } = useUserInfo()

  // Updated toggleFavourite function to use API object
  const toggleFavourite = (course: UserCourse) => {
    const newStatus = !course.favourited
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
        message.error(getErrorMessage(err))
      })
  }

  const columns: ColumnsType<UserCourse> = [
    {
      key: 'favourite',
      width: '5%',
      align: 'center',
      render: (_, course) =>
        course.favourited ? (
          <StarFilled
            onClick={() => toggleFavourite(course)}
            style={{ color: 'gold', cursor: 'pointer', fontSize: '1rem' }}
          />
        ) : (
          <StarOutlined
            onClick={() => toggleFavourite(course)}
            style={{ color: 'grey', cursor: 'pointer' }}
          />
        ),
    },
    {
      dataIndex: ['course', 'name'],
      key: 'name',
      width: '70%',
      align: 'left',
      render: (text, course) => (
        <span className="flex items-center text-lg font-semibold">
          {text}
          {course.course.sectionGroupName && (
            <span className="ml-1 text-sm text-gray-600">{`[${course.course.sectionGroupName}]`}</span>
          )}
        </span>
      ),
    },
    {
      dataIndex: 'role',
      key: 'role',
      width: '10%',
      align: 'center',
      render: (role) => (
        <Tag
          color={
            role === Role.STUDENT
              ? 'success'
              : role === Role.TA
                ? 'gold'
                : 'volcano'
          }
          className="text-base capitalize"
        >
          {role}
        </Tag>
      ),
    },
    {
      key: 'actions',
      width: '20%',
      align: 'center',
      render: (_, course) => (
        <div className="flex w-full flex-col items-end justify-center gap-2 md:flex-row md:items-center md:justify-end">
          <Link href={`/course/${course.course.id}`}>
            <Button
              type="primary"
              className="rounded text-sm md:p-[1.1rem] md:font-medium"
            >
              Course Page
            </Button>
          </Link>
          {course.role === Role.PROFESSOR && (
            <Link href={`/course/${course.course.id}/settings`}>
              <Button className="rounded p-[1.1rem] text-sm md:font-medium">
                Edit Course
              </Button>
            </Link>
          )}
        </div>
      ),
    },
  ]

  // Allow recalculation for course favouriting feature (harder to memoize)
  const coursesWithoutSemester = useMemo(() => {
    return userInfo.courses.filter((userCourse) => {
      return !semesters?.some(
        (semester) => semester.id === userCourse.course.semesterId,
      )
    })
  }, [userInfo.courses, semesters])

  const sortedCoursesInCardView = useMemo(() => {
    return [...userInfo.courses]
      .filter(
        (userCourse) => userCourse.favourited && userCourse.course.enabled,
      )
      .sort((a, b) => {
        const semesterA = semesters?.find(
          (semester) => semester.id === a.course.semesterId,
        )
        const semesterB = semesters?.find(
          (semester) => semester.id === b.course.semesterId,
        )
        if (semesterA && semesterB) {
          const diff = semesterB.endDate.valueOf() - semesterA.endDate.valueOf()
          if (diff === 0) {
            return a.course.name.localeCompare(b.course.name)
          } else {
            return diff
          }
        }
        return 0
      })
  }, [userInfo.courses, semesters])

  return (
    <div className="mb-8 mt-5 w-full">
      {enabledTableView ? (
        <>
          {semesters
            ?.sort((a, b) => b.endDate.valueOf() - a.endDate.valueOf())
            .map((semester) => {
              const semesterCourses = userInfo.courses.filter(
                (userCourse) => userCourse.course.semesterId === semester.id,
              )
              if (semesterCourses.length === 0) {
                return null
              }

              const popoverContent = (
                <div className="p-2">
                  <p>
                    <strong>Start Date:</strong>{' '}
                    {new Date(semester.startDate).toLocaleDateString()}
                  </p>
                  <p>
                    <strong>End Date:</strong>{' '}
                    {new Date(semester.endDate).toLocaleDateString()}
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
                    <Divider className="my-1 p-2 text-lg font-semibold">
                      {semester.name}
                    </Divider>
                  </Popover>
                  <Table
                    columns={columns}
                    size="small"
                    dataSource={semesterCourses
                      .filter((userCourse) => userCourse.course.enabled)
                      .sort((a, b) =>
                        a.course.name.localeCompare(b.course.name),
                      )}
                    rowKey={(course) => course.course.id}
                    pagination={
                      semesterCourses.length > 5 ? { pageSize: 5 } : false
                    }
                    showHeader={false}
                  />
                </div>
              )
            })}

          {coursesWithoutSemester.length > 0 && (
            <div key={-1}>
              <Divider className="my-1 p-2 text-lg font-semibold">
                <Tooltip title="Courses that are not assigned to a semester">
                  Not Assigned
                </Tooltip>
              </Divider>
              <Table
                columns={columns}
                size="small"
                dataSource={coursesWithoutSemester.sort((a, b) =>
                  a.course.name.localeCompare(b.course.name),
                )}
                rowKey={(course) => course.course.id}
                pagination={
                  coursesWithoutSemester.length > 5 ? { pageSize: 5 } : false
                }
                showHeader={false}
              />
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-wrap gap-3">
          {sortedCoursesInCardView.map((course, index) => {
            // Generate course icon
            const iconSvg = jdenticon.toSvg(course.course.name, iconSize)
            const iconDataUrl = `data:image/svg+xml;base64,${btoa(iconSvg)}`

            const courseSemester = semesters?.find(
              (s) => s.id === course.course.semesterId,
            )

            const popoverContent = courseSemester ? (
              <div className="p-2">
                <p>
                  <strong>Start Date:</strong>{' '}
                  {new Date(courseSemester.startDate).toLocaleDateString()}
                </p>
                <p>
                  <strong>End Date:</strong>{' '}
                  {new Date(courseSemester.endDate).toLocaleDateString()}
                </p>
                {courseSemester.description && (
                  <p>
                    <strong>Description:</strong> {courseSemester.description}
                  </p>
                )}
              </div>
            ) : null

            return (
              <Card
                key={course.course.id}
                className="m-2 w-full shadow md:w-[46%] lg:w-[30.5%] xl:w-[22.5%]"
                cover={
                  <div className="relative block h-32 w-full">
                    <div
                      className="absolute inset-0 rounded-t"
                      style={{
                        background: `${stringToHexColor(course.course.name)}`,
                        opacity: 0.8,
                      }}
                    />
                    <div
                      className="absolute inset-0 rounded-t"
                      style={{
                        backgroundImage: `url(${iconDataUrl})`,
                        backgroundRepeat: 'repeat',
                        backgroundPosition: `-${iconSize / 2}px -${iconSize / 2}px`,
                        opacity: 0.3,
                      }}
                    />
                  </div>
                }
              >
                <div className="flex flex-wrap items-start justify-between align-middle">
                  <Meta
                    title={course.course.name}
                    description={
                      course.course.sectionGroupName ? (
                        <div className="h-4 text-xs font-semibold text-gray-600">
                          {`[${course.course.sectionGroupName}]`}
                        </div>
                      ) : (
                        <div className="h-4"></div>
                      )
                    }
                  />
                  <Tag
                    color={
                      course.role === Role.STUDENT
                        ? 'success'
                        : course.role === Role.TA
                          ? 'gold'
                          : 'volcano'
                    }
                    className="text-base capitalize"
                  >
                    {course.role == Role.TA ? 'TA' : course.role}
                  </Tag>
                </div>

                <div className="absolute right-2 top-2 flex flex-wrap items-center justify-between align-middle">
                  {courseSemester ? (
                    <Popover
                      content={popoverContent}
                      title={courseSemester.name}
                    >
                      <Tag color="blue" className="text-base">
                        {courseSemester.name}
                      </Tag>
                    </Popover>
                  ) : (
                    <Tooltip title="Courses that are not assigned to a semester">
                      <Tag color="blue" className="text-base">
                        Not Assigned
                      </Tag>
                    </Tooltip>
                  )}
                </div>

                <Link
                  id={index === 0 ? 'skip-link-target' : ''}
                  href={`course/${course.course.id}`}
                >
                  <Button
                    type="primary"
                    className="mt-5 rounded p-[1.1rem] font-medium"
                    block
                  >
                    Course page
                  </Button>
                </Link>

                {course.role === Role.PROFESSOR && (
                  <Link href={`/course/${course.course.id}/settings`}>
                    <Button
                      type="primary"
                      className="mt-4 rounded p-[1.1rem] font-medium"
                      block
                    >
                      Edit Course
                    </Button>
                  </Link>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default CoursesSection
