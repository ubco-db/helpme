import { Card } from 'antd'
import CourseRosterTables from '../components/CourseRosterTables'

export default async function CourseRoster({
  params,
}: {
  params: { cid: string }
}) {
  return (
    <Card
      title="Course Roster"
      classNames={{
        body: 'p-1 md:p-8',
      }}
    >
      <CourseRosterTables courseId={Number(params.cid)} />
    </Card>
  )
}
