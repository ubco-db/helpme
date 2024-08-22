import React, { useEffect, useState } from 'react'
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
} from 'antd'
const { Text } = Typography

const EmailNotifications: React.FC = () => {
  const [form] = Form.useForm()
  const [subscriptions, setSubscriptions] = useState<
    { id: any; name: any; isSubscribed: any; mailType: string }[]
  >([])
  const [isFormChanged, setIsFormChanged] = useState(false)

  const fetchSubscriptions = () => {
    API.emailNotification.get().then((data) => {
      const formattedData = data.map((notif: any) => ({
        id: notif.id,
        name: notif.name,
        isSubscribed: notif.isSubscribed,
        mailType: notif.mailType,
      }))
      setSubscriptions(formattedData)

      const initialValues: { [key: string]: boolean } = formattedData.reduce<{
        [key: string]: boolean
      }>((acc, sub) => {
        acc[sub.id] = sub.isSubscribed
        return acc
      }, {})
      form.setFieldsValue(initialValues)
    })
  }

  useEffect(() => {
    fetchSubscriptions()
  }, [form])

  const handleOk = async () => {
    try {
      const values = form.getFieldsValue()
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
    } catch (error) {
      console.error('Failed to save notification settings:', error)
      message.error('Failed to update notification settings')
    }
  }

  const handleFormChange = () => {
    const currentValues = form.getFieldsValue()
    const hasChanged = subscriptions.some(
      (sub) => currentValues[sub.id] !== sub.isSubscribed,
    )
    setIsFormChanged(hasChanged)
  }

  const renderSubscriptions = (mailType: string) => (
    <Form.Item noStyle>
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
    </Form.Item>
  )

  return (
    <div>
      <Form form={form} layout="vertical" onValuesChange={handleFormChange}>
        <Row gutter={24}>
          <Col span={11}>
            <Typography.Title level={4}>Other Notifications</Typography.Title>
            {renderSubscriptions('professor')}
          </Col>
          <Col span={2}>
            <Divider type="vertical" style={{ height: '100%' }} />
          </Col>
          <Col span={11}>
            <Typography.Title level={4}>Member Notifications</Typography.Title>
            {renderSubscriptions('member')}
          </Col>
        </Row>
      </Form>
      <Button
        key="submit"
        type="primary"
        onClick={handleOk}
        disabled={!isFormChanged}
        style={{ marginTop: '30px', marginBottom: '15px' }}
      >
        Save
      </Button>
    </div>
  )
}

export default EmailNotifications
