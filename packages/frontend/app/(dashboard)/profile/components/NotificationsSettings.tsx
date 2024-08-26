import { API } from '@/app/api'
import { Button, Card, Form, message, Switch, Tooltip } from 'antd'
import useSWR from 'swr'
import { pick } from 'lodash'
import { GetProfileResponse, UpdateProfileParams } from '@koh/common'
import { BellOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import DeviceNotificationPanel from './DeviceNotificationPanel'
import { getErrorMessage } from '@/app/utils/generalUtils'
import { useUserInfo } from '@/app/contexts/userContext'

const NotificationsSettings: React.FC = () => {
  const { data: profile, mutate } = useSWR(`api/v1/profile`, async () =>
    API.profile.index(),
  )
  const { userInfo, setUserInfo } = useUserInfo()

  const [form] = Form.useForm()

  const editProfile = async (updateProfile: UpdateProfileParams) => {
    const newProfile = { ...profile, ...updateProfile }
    mutate(newProfile as GetProfileResponse, false)
    await API.profile.patch(pick(newProfile, ['desktopNotifsEnabled']))
    const newUser = await mutate() //update the context
    setUserInfo({
      ...userInfo,
      desktopNotifsEnabled: newUser
        ? newUser.desktopNotifsEnabled
        : userInfo.desktopNotifsEnabled,
    })
    return newProfile
  }

  const handleOk = async () => {
    const value = await form.validateFields()
    try {
      const newProfile = await editProfile(value)
      form.setFieldsValue(newProfile)
      message.success(
        'Your notification settings have been successfully updated',
      )
    } catch (e) {
      const errorMessage = getErrorMessage(e)
      message.error('Error updating notification settings:' + errorMessage)
    }
  }

  return (
    <Card
      title={
        <h2>
          <BellOutlined /> Browser Notifications
        </h2>
      }
      bordered
      className="my-2"
      classNames={{ body: 'py-2' }}
    >
      <h3 className="mb-2 text-lg text-gray-500">
        Get notified when you are getting helped (student) or when a new student
        enters the queue (staff). These will also work on mobile!
      </h3>
      <Form wrapperCol={{ span: 10 }} form={form} initialValues={profile}>
        <Form.Item
          style={{ flex: 1 }}
          label="Enable notifications on all devices"
          name="desktopNotifsEnabled"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>
        <Form.Item shouldUpdate noStyle>
          {() =>
            form.getFieldValue('desktopNotifsEnabled') && (
              <DeviceNotificationPanel />
            )
          }
        </Form.Item>
        <Tooltip title="Notification still doesn't work? Click here!">
          <QuestionCircleOutlined
            className="float-right mt-[30px] text-2xl"
            onClick={() =>
              window.open(
                'https://www.makeuseof.com/google-chrome-notifications-not-working-fixes/',
              )
            }
          />
        </Tooltip>
      </Form>
      <Button
        key="submit"
        type="primary"
        onClick={handleOk}
        className="mb-4 mt-8"
      >
        Save
      </Button>
    </Card>
  )
}

export default NotificationsSettings
