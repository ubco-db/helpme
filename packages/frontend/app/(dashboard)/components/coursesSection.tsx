import { UserCourse } from '@koh/common'
import { Card, Tag } from 'antd'
import React from 'react'
import Meta from 'antd/es/card/Meta'
import Link from 'next/link'
import { CourseRole } from '@/app/typings/user'
import stringToHexColor from '@/app/utils/colorUtils'

interface CoursesSectionProps {
  courses: UserCourse[]
}

const CoursesSection: React.FC<CoursesSectionProps> = ({ courses }) => {
  return (
    <div className="mb-8 mt-5 flex w-full flex-wrap gap-3">
      {courses?.map((course, index) => (
        <Card
          key={course.course.id}
          className="m-2 w-full md:w-1/2 lg:w-1/3 xl:w-1/4"
          cover={
            <div
              className={`block h-40 w-full rounded`}
              style={{ background: `${stringToHexColor(course.course.name)}` }}
            ></div>
          }
        >
          <div className="flex items-center justify-between align-middle">
            <Meta title={course.course.name} />
            <Tag color="success" className="text-base capitalize">
              {course.role}
            </Tag>
          </div>

          <Link
            id={index == 0 ? 'skip-link-target' : ''}
            className="ant-btn ant-btn-primary ant-btn-block mt-5 block rounded p-2 text-center font-medium text-white"
            href={`course/${course.course.id}`}
            aria-label={`${course.course.name} Course Page`}
          >
            Course page
          </Link>

          {(course.role as unknown as CourseRole) === CourseRole.PROFESSOR && (
            <Link
              className="ant-btn ant-btn-primary ant-btn-block mt-4 block rounded p-2 text-center font-medium text-white"
              href={`organization/course/${course.course.id}/edit`}
            >
              Edit Course
            </Link>
          )}
        </Card>
      ))}
    </div>
  )
}

export default CoursesSection
