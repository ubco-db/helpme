import React, { useEffect, useState, useCallback } from 'react'
import { API } from '@/app/api'
import {
  Button,
  Form,
  message,
  Switch,
  Typography,
  Row,
  Col,
  Divider,
  Card,
} from 'antd'
const { Text } = Typography
import { getErrorMessage } from '@/app/utils/generalUtils'
import { MailOutlined } from '@ant-design/icons'
import { useUserInfo } from '@/app/contexts/userContext'
import { OrganizationRole, Role } from '@koh/common'

interface Subscription {
  id: number
  name: string
  isSubscribed: boolean
  mailType: string
}

const EmailNotifications: React.FC = () => {
  const [form] = Form.useForm()
  const { userInfo } = useUserInfo()
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [isFormChanged, setIsFormChanged] = useState(false)
  const [initialValues, setInitialValues] = useState<{
    [key: string]: boolean
  }>({})

  const isStaffInAnyCourse = userInfo.courses.some(
    (uc) => uc.role === Role.TA || uc.role === Role.PROFESSOR,
  )

  // The only people that have access to staff notifications are staff or if they are subscribed to any 'professor' type email notifications
  const showStaffNotifications =
    isStaffInAnyCourse ||
    userInfo.userRole === OrganizationRole.PROFESSOR ||
    userInfo.userRole === OrganizationRole.ADMIN

  const fetchSubscriptions = useCallback(async () => {
    try {
      const data = await API.emailNotification.get()
      const formattedData = data.map((notif: any) => ({
        id: notif.id,
        name: notif.name,
        isSubscribed: notif.isSubscribed,
        mailType: notif.mailType,
      }))
      setSubscriptions(formattedData)

      const newInitialValues = formattedData.reduce<{ [key: string]: boolean }>(
        (acc, sub) => {
          acc[sub.id] = sub.isSubscribed
          return acc
        },
        {},
      )
      setInitialValues(newInitialValues)
      form.setFieldsValue(newInitialValues)
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      message.error('Failed to load notification settings' + errorMessage)
    }
  }, [form])

  useEffect(() => {
    fetchSubscriptions()
  }, [fetchSubscriptions])

  const onFinish = async (values: { [key: string]: boolean }) => {
    try {
      const promises = Object.entries(values).map(
        ([mailServiceId, isSubscribed]) =>
          API.emailNotification.update(
            parseInt(mailServiceId, 10),
            Boolean(isSubscribed),
          ),
      )

      await Promise.all(promises)

      message.success('Notification settings updated successfully')
      setSubscriptions(
        subscriptions.map((sub) => ({
          ...sub,
          isSubscribed: values[sub.id],
        })),
      )
      setIsFormChanged(false)
      setInitialValues(values)
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      message.error('Error updating notification settings:' + errorMessage)
    }
  }

  const handleFormChange = useCallback(
    (changedValues: any, allValues: any) => {
      const hasChanged = Object.keys(initialValues).some(
        (key) => allValues[key] !== initialValues[key],
      )
      setIsFormChanged(hasChanged)
    },
    [initialValues],
  )

  const renderSubscriptions = (mailType: string) => (
    <div>
      {subscriptions
        .filter((sub) => sub.mailType === mailType)
        .map((subscription) => (
          <Form.Item
            key={subscription.id}
            label={<Text strong>{subscription.name}</Text>}
            name={subscription.id}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        ))}
    </div>
  )
  return (
    <Card
      title={
        <h2>
          <MailOutlined /> Email Notifications
        </h2>
      }
      bordered
      classNames={{ body: 'py-2' }}
    >
      <h3 className="mb-2 text-lg text-gray-500">
        Choose what emails you would like to subscribe to. Emails will be sent
        to{' '}
        <span className="font-medium text-blue-700/60">{userInfo.email}</span>
      </h3>
      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleFormChange}
        initialValues={initialValues}
        onFinish={onFinish}
      >
        <Row gutter={24}>
          <Col span={showStaffNotifications ? 11 : 24}>
            {showStaffNotifications && (
              <Typography.Title level={4}>
                Member Notifications
              </Typography.Title>
            )}
            {renderSubscriptions('member')}
          </Col>
          {showStaffNotifications && (
            <>
              <Col span={2}>
                <Divider type="vertical" style={{ height: '100%' }} />
              </Col>
              <Col span={11}>
                <Typography.Title level={4}>
                  Staff-Only Notifications
                </Typography.Title>
                {renderSubscriptions('professor')}
              </Col>
            </>
          )}
        </Row>
        <Form.Item className="mb-4">
          <Button
            key="submit"
            type="primary"
            htmlType="submit"
            disabled={!isFormChanged}
            className="mt-8"
          >
            Save
          </Button>
        </Form.Item>
      </Form>
    </Card>
  )
}

export default EmailNotifications
