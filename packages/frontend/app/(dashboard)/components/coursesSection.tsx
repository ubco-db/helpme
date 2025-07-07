import { OrganizationRole, Role, SemesterPartial } from '@koh/common'
import { Button, Card, Tag, Tooltip } from 'antd'
import React, { useMemo } from 'react'
import Meta from 'antd/es/card/Meta'
import Link from 'next/link'
import stringToHexColor from '@/app/utils/generalUtils'
import { useUserInfo } from '@/app/contexts/userContext'
import SemesterInfoPopover from './SemesterInfoPopover'
import CoursesSectionTableView from './CoursesSectionTableView'

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
  const { userInfo } = useUserInfo()
  const isStaff = useMemo(() => {
    return userInfo?.organization?.organizationRole === OrganizationRole.ADMIN
  }, [userInfo.organization])

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
        // Show courses with defined semesters first
        if (semesterA && !semesterB) return -1
        if (semesterB && !semesterA) return 1

        if (semesterA && semesterB) {
          const diff =
            new Date(semesterB.endDate).getTime() -
            new Date(semesterA.endDate).getTime()
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
    <div className="mb-8 w-full">
      {enabledTableView ? (
        <CoursesSectionTableView semesters={semesters} />
      ) : (
        <div className="mt-5 flex flex-wrap gap-3">
          {sortedCoursesInCardView.map((course, index) => {
            // Generate course icon
            const iconSvg = jdenticon.toSvg(course.course.name, iconSize)
            const iconDataUrl = `data:image/svg+xml;base64,${btoa(iconSvg)}`

            const courseSemester = semesters?.find(
              (s) => s.id === course.course.semesterId,
            )

            const isThereAnotherCourseWithSameNameAndSemester =
              userInfo.courses.some(
                (c) =>
                  c.course.id !== course.course.id &&
                  c.course.name === course.course.name &&
                  c.course.semesterId === course.course.semesterId,
              )

            return (
              <Card
                key={course.course.id}
                className="m-2 w-full shadow md:w-[46%] lg:w-[30.5%] xl:w-[22.5%]"
                cover={
                  <div className="relative block h-24 w-full md:h-32">
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
                <div className="flex flex-wrap items-center justify-between">
                  <Meta
                    title={
                      <span className="text-lg md:text-base">
                        {course.course.name}
                        {course.course.sectionGroupName &&
                          isThereAnotherCourseWithSameNameAndSemester && (
                            <Tooltip
                              title={
                                course.course.sectionGroupName +
                                ' is the section for this course'
                              }
                            >
                              <span className="text-gray-500">
                                {' ' + course.course.sectionGroupName}
                              </span>
                            </Tooltip>
                          )}
                      </span>
                    }
                  />
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
                    {course.role == Role.TA ? 'TA' : course.role}
                  </Tag>
                </div>

                <div className="absolute right-2 top-2 flex flex-wrap items-center justify-between align-middle">
                  {courseSemester ? (
                    <SemesterInfoPopover semester={courseSemester}>
                      <Tag
                        color={courseSemester.color}
                        bordered={false}
                        className="text-sm opacity-80 hover:opacity-100"
                      >
                        {courseSemester.name}
                      </Tag>
                    </SemesterInfoPopover>
                  ) : isStaff || course.role == Role.PROFESSOR ? (
                    <Tooltip title="This course is not assigned to a semester">
                      <Tag
                        color="blue"
                        bordered={false}
                        className="text-sm opacity-80 hover:opacity-100"
                      >
                        No Semester
                      </Tag>
                    </Tooltip>
                  ) : null}
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
