import { Role, UserCourse } from '@koh/common'
import { Button, Card, Divider, Table, Tag } from 'antd'
import React from 'react'
import Meta from 'antd/es/card/Meta'
import Link from 'next/link'
import stringToHexColor from '@/app/utils/generalUtils'
import { ColumnsType } from 'antd/es/table'

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
          {/* PAT TODO: remove ui mock and actually implement (hopefully with more userCourses) */}
          <Divider className="mt-5 p-2 text-lg font-semibold">{`W2024 (example semester)`}</Divider>
          <Table
            columns={columns}
            dataSource={courses}
            rowKey={(course) => course.course.id}
            pagination={courses.length > 5 ? { pageSize: 5 } : false}
            showHeader={false}
          />
          <Divider className="mt-5 p-2 text-lg font-semibold">{`S2024 (example semester)`}</Divider>
          <Table
            columns={columns}
            dataSource={courses}
            rowKey={(course) => course.course.id}
            pagination={courses.length > 5 ? { pageSize: 5 } : false}
            showHeader={false}
          />
        </>
      ) : (
        <div className="flex flex-wrap gap-3">
          {courses?.map((course, index) => {
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
