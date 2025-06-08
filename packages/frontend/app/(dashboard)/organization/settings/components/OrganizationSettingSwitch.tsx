import { API } from '@/app/api'
import { QuestionCircleOutlined } from '@ant-design/icons'
import { message, Switch, Tooltip } from 'antd'

type OrganizationSettingSwitchProps = {
  settingName: string
  defaultChecked: boolean
  title: string
  description: string
  organizationId: number
  disabled?: boolean
}

const OrganizationSettingSwitch: React.FC<OrganizationSettingSwitchProps> = ({
  settingName,
  defaultChecked,
  title,
  description,
  organizationId,
  disabled = false,
}) => {
  return (
    <div className="flex items-center justify-between p-2 align-middle">
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
          await API.organizations
            .setOrganizationSetting(
              organizationId,
              settingName,
              e.valueOf() as boolean,
            )
            .then(() => {
              message.success(
                `Successfully set ${settingName} feature to ${e.valueOf()}`,
              )
            })
            .catch((error) => {
              message.error(
                `An error occured while toggling ${settingName} feature: ${error.message}`,
              )
            })
        }}
      />
    </div>
  )
}

export default OrganizationSettingSwitch
