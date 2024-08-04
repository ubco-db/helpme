import { Role, UserCourse } from '@koh/common'
import { Button, Card, Tag } from 'antd'
import React from 'react'
import Meta from 'antd/es/card/Meta'
import Link from 'next/link'
import { CourseRole } from '@/app/typings/user'
import stringToHexColor from '@/app/utils/generalUtils'

interface CoursesSectionProps {
  courses: UserCourse[]
}

const CoursesSection: React.FC<CoursesSectionProps> = ({ courses }) => {
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

  return (
    <div className="mb-8 mt-5 flex w-full flex-wrap gap-3">
      {courses?.map((course, index) => {
        // generate little icons for each course
        const iconSvg = jdenticon.toSvg(course.course.name, iconSize)
        // convert the svg to a data url that can be used elsewhere
        const iconDataUrl = `data:image/svg+xml;base64,${btoa(iconSvg)}`

        return (
          <Card
            key={course.course.id}
            className="m-2 w-full shadow md:w-1/2 lg:w-1/3 xl:w-1/4"
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
            <div className="flex items-center justify-between align-middle">
              <Meta title={course.course.name} />
              <Tag color="success" className="text-base capitalize">
                {course.role}
              </Tag>
            </div>

            <Link
              id={index == 0 ? 'skip-link-target' : ''}
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
  )
}

export default CoursesSection
