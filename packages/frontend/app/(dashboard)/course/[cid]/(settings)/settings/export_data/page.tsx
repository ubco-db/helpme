import { Card } from 'antd'
import CourseExportData from '../components/CourseExportData'

export default async function ExportData(props: {
  params: Promise<{ cid: string }>
}) {
  const params = await props.params
  return (
    <Card title="Export Data">
      <CourseExportData courseId={Number(params.cid)} />
    </Card>
  )
}
