import { CourseCloneAttributes, GetOrganizationResponse } from '@koh/common'
import { FormInstance } from 'antd'
import React, { useEffect } from 'react'
import CourseCloneForm from '../../components/CourseCloneForm'

type DefaultCourseSettingsSelectionProps = {
  defaultValues: CourseCloneAttributes
  organization: GetOrganizationResponse
  form: FormInstance
}

const DefaultCourseSettingsSelection: React.FC<
  DefaultCourseSettingsSelectionProps
> = ({ defaultValues, organization, form }) => {
  useEffect(() => {
    form.resetFields()
  }, [defaultValues, form])

  return (
    <CourseCloneForm
      form={form}
      isAdmin={true}
      organization={organization}
      courseSemesterId={-1}
      courseSectionGroupName={' '}
    />
  )
}

export default DefaultCourseSettingsSelection
