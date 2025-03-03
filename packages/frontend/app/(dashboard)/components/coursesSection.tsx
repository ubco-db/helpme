import { Role, SemesterPartial, UserCourse } from '@koh/common'
import { Button, Card, Divider, message, Table, Tag } from 'antd'
import React, { useEffect, useState } from 'react'
import Meta from 'antd/es/card/Meta'
import Link from 'next/link'
import stringToHexColor from '@/app/utils/generalUtils'
import { ColumnsType } from 'antd/es/table'
import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'

interface CoursesSectionProps {
  courses: UserCourse[]
  enabledTableView: boolean
}

const CoursesSection: React.FC<CoursesSectionProps> = ({
  courses,
  enabledTableView,
}) => {
  // For some reason, jdenticon is not working when imported as a module and needs to use require
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const jdenticon = require('jdenticon')
  const iconSize = 60
  const { userInfo } = useUserInfo()
  const [semesters, setSemesters] = useState<SemesterPartial[]>()

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

  useEffect(() => {
    API.semesters
      .get(userInfo.organization?.orgId || -1)
      .then((semesters) => {
        setSemesters(semesters)
      })
      .catch((error) => {
        message.error(
          'Failed to fetch semesters for organization with id: ' +
            userInfo.organization?.id,
        )
      })
  }, [])

  const columns: ColumnsType<UserCourse> = [
    {
      dataIndex: ['course', 'name'],
      key: 'name',
      width: '70%',
      align: 'left',
      render: (text, course) => (
        <span className="text-lg font-semibold">{text}</span>
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
                : 'blue'
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
        <div className="flex w-full justify-end gap-2">
          <Link href={`/course/${course.course.id}`}>
            <Button type="primary" className="rounded p-[1.1rem] font-medium">
              Course Page
            </Button>
          </Link>
          {course.role === Role.PROFESSOR && (
            <Link href={`/course/${course.course.id}/settings`}>
              <Button className="rounded p-[1.1rem] font-medium">
                Edit Course
              </Button>
            </Link>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="mb-8 mt-5 w-full">
      {enabledTableView ? (
        <>
          {semesters
            ?.sort((a, b) => b.endDate.valueOf() - a.endDate.valueOf())
            .map((semester) => {
              const semesterCourses = courses.filter(
                (course) => course.course.semesterId === semester.id,
              )
              if (semesterCourses.length === 0) {
                return null
              }
              return (
                <div key={semester.id}>
                  <Divider className="my-1 p-2 text-lg font-semibold">
                    {semester.name}
                  </Divider>
                  <Table
                    columns={columns}
                    size="small"
                    dataSource={semesterCourses.sort((a, b) =>
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
        </>
      ) : (
        <div className="flex flex-wrap gap-3">
          {courses
            ?.sort((a, b) => {
              const semesterA = semesters?.find(
                (semester) => semester.id === a.course.semesterId,
              )
              const semesterB = semesters?.find(
                (semester) => semester.id === b.course.semesterId,
              )
              if (semesterA && semesterB) {
                const diff =
                  semesterB.endDate.valueOf() - semesterA.endDate.valueOf()
                if (diff == 0) {
                  return a.course.name.localeCompare(b.course.name)
                } else {
                  return diff
                }
              }
              return 0
            })
            .map((course, index) => {
              // Generate course icon
              const iconSvg = jdenticon.toSvg(course.course.name, iconSize)
              const iconDataUrl = `data:image/svg+xml;base64,${btoa(iconSvg)}`

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
                  <div className="flex flex-wrap items-center justify-between align-middle">
                    <Meta title={course.course.name} />
                    <Tag
                      color={
                        course.role === Role.STUDENT
                          ? 'success'
                          : course.role === Role.TA
                            ? 'gold'
                            : 'blue'
                      }
                      className="text-base capitalize"
                    >
                      {course.role}
                    </Tag>
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
