import { Card } from 'antd'
import { ReactElement } from 'react'
import CoursesTable from '../components/CoursesTable'

const CoursesPage: React.FC = (): ReactElement => {
  return (
    <Card title="Courses">
      <CoursesTable />
    </Card>
  )
}

export default CoursesPage
