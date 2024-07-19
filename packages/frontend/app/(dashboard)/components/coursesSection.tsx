import { UserCourse } from '@koh/common'
import { Card, Tag } from 'antd'
import React from 'react'
import Image from 'next/image'
import Meta from 'antd/es/card/Meta'
import Link from 'next/link'
import { CourseRole } from '@/app/typings/user'

interface CoursesSectionProps {
  courses: UserCourse[]
}

const CoursesSection: React.FC<CoursesSectionProps> = ({ courses }) => {
  return (
    <div className="mb-8 mt-5 flex w-full flex-wrap gap-3">
      {courses?.map((course, index) => (
        <Card
          key={course.course.id}
          className="m-2 w-full md:w-auto"
          cover={
            <Image
              alt="Course Image Banner"
              width={100}
              height={100}
              unoptimized={true}
              className="h-40 w-full rounded object-cover object-center"
              src="https://open-2021.sites.olt.ubc.ca/files/2020/10/OSIP-2020-Slider.jpg"
            />
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
