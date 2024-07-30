import { Card } from 'antd'
import CourseExportData from '../components/CourseExportData'

export default async function ExportData({
  params,
}: {
  params: { cid: string }
}) {
  return (
    <Card title="Export Data">
      <CourseExportData courseId={Number(params.cid)} />
    </Card>
  )
}
