'use client'

import { API } from '@/app/api'
import { useUserInfo } from '@/app/contexts/userContext'
import { useCourseFeatures } from '@/app/hooks/useCourseFeatures'
import { getErrorMessage, getRoleInCourse } from '@/app/utils/generalUtils'
import { Role } from '@koh/common'
import { Card, Switch, Typography, message } from 'antd'
import { ReactElement, use, useState } from 'react'
import { mutate } from 'swr'

export default function AssignmentEvaluationSettingsPage(props: {
  params: Promise<{ cid: string }>
}): ReactElement {
  const params = use(props.params)
  const courseId = Number(params.cid)
  const { userInfo } = useUserInfo()
  const role = getRoleInCourse(userInfo, courseId)
  const features = useCourseFeatures(courseId)
  const [loading, setLoading] = useState(false)

  const enabled = features?.assignmentEvaluationEnabled ?? false
  const canEdit = role === Role.PROFESSOR

  const onChange = async (checked: boolean) => {
    setLoading(true)
    try {
      await API.course.setCourseFeature(
        courseId,
        'assignmentEvaluationEnabled',
        checked,
      )
      await mutate(`${courseId}/features`)
      message.success('Course settings updated.')
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <Typography.Title level={3} className="!mb-6">
        Chatbot · Assignment evaluation
      </Typography.Title>
      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Typography.Text strong className="block">
              Enable assignment evaluation
            </Typography.Text>
            <Typography.Paragraph type="secondary" className="!mb-0 mt-1 max-w-xl">
              When enabled, the course home page shows an &quot;Assignment / report
              feedback&quot; card. Students and staff can open the feedback tool
              in a new tab. The tool uses the same model as your course chatbot
              settings.
            </Typography.Paragraph>
          </div>
          <Switch
            checked={enabled}
            loading={loading}
            disabled={!canEdit}
            onChange={onChange}
            checkedChildren="On"
            unCheckedChildren="Off"
          />
        </div>
        {!canEdit && (
          <Typography.Paragraph type="secondary" className="mt-4 !mb-0">
            Only instructors can change this setting.
          </Typography.Paragraph>
        )}
      </Card>
    </div>
  )
}
