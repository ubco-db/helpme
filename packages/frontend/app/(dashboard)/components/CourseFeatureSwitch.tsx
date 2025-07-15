import { API } from '@/app/api'
import { QuestionCircleOutlined } from '@ant-design/icons'
import { message, Switch, Tooltip } from 'antd'

type CourseFeatureSwitchProps = {
  featureName: string
  defaultChecked: boolean
  title: string
  description: string
  courseId: number
  disabled?: boolean
  className?: string
}

const CourseFeatureSwitch: React.FC<CourseFeatureSwitchProps> = ({
  featureName,
  defaultChecked,
  title,
  description,
  courseId,
  disabled = false,
  className = '',
}) => {
  return (
    <div
      className={`flex items-center justify-between p-2 align-middle ${className}`}
    >
      <span className="block">
        {title}&nbsp;
        <Tooltip title={description}>
          <QuestionCircleOutlined />
        </Tooltip>
      </span>
      <Switch
        defaultChecked={defaultChecked}
        className="mt-0 pt-0"
        disabled={disabled}
        onChange={async (e) => {
          await API.course
            .setCourseFeature(courseId, featureName, e.valueOf() as boolean)
            .then(() => {
              message.success(
                `Successfully set ${featureName} feature to ${e.valueOf()}`,
              )
            })
            .catch((error) => {
              message.error(
                `An error occured while toggling ${featureName} feature: ${error.message}`,
              )
            })
        }}
      />
    </div>
  )
}

export default CourseFeatureSwitch
