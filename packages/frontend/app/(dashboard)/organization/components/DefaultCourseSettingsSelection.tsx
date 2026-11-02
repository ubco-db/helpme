import type {
  CourseCloneAttributes,
  GetOrganizationResponse,
} from '@koh/common';
import type { FormInstance } from 'antd';
import type React from 'react';
import { useEffect } from 'react';
import CourseCloneForm from '../../components/CourseCloneForm';

type DefaultCourseSettingsSelectionProps = {
  defaultValues: CourseCloneAttributes;
  organization: GetOrganizationResponse;
  form: FormInstance;
};

const DefaultCourseSettingsSelection: React.FC<
  DefaultCourseSettingsSelectionProps
> = ({ defaultValues, organization, form }) => {
  useEffect(() => {
    form.resetFields();
    form.setFieldsValue({
      newSemesterId: -1,
      newSection: '',
    });
  }, [defaultValues, form]);

  return (
    <CourseCloneForm
      form={form}
      isAdmin={true}
      organization={organization}
      courseSemesterId={-1}
      courseSectionGroupName={''}
    />
  );
};

export default DefaultCourseSettingsSelection;
