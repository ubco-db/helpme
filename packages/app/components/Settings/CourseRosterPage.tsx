import { ReactElement } from 'react'
import styled from 'styled-components'
import CourseRoster from './CourseRoster'

type CourseRosterPageProps = { courseId: number }

const CourseRosterPageComponent = styled.div`
  width: 90%;
  margin-left: auto;
  margin-right: auto;
  padding-top: 50px;
`

export default function CourseRosterPage({
  courseId,
}: CourseRosterPageProps): ReactElement {
  return (
    <CourseRosterPageComponent>
      <CourseRoster courseId={courseId} />
    </CourseRosterPageComponent>
  )
}
