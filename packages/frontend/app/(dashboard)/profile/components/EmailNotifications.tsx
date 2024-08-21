import React, { useEffect, useState } from 'react'
import { API } from '@/app/api'
import { Button, Form, message, Switch, Typography } from 'antd'
import useSWR from 'swr'

const { Text } = Typography

const EmailNotifications: React.FC = () => {
  const { data: profile, mutate } = useSWR('api/v1/profile', async () =>
    API.profile.index(),
  )
  const [form] = Form.useForm()
  const [subscriptions, setSubscriptions] = useState<
    { id: any; name: any; isSubscribed: any }[]
  >([])
  const [isFormChanged, setIsFormChanged] = useState(false)

  useEffect(() => {
    API.emailNotification.get().then((data) => {
      const formattedData = data.map((notif: any) => ({
        id: notif.id,
        name: notif.name,
        isSubscribed: notif.isSubscribed,
      }))
      setSubscriptions(formattedData)

      // Set initial values for the form
      const initialValues: { [key: string]: boolean } = formattedData.reduce<{
        [key: string]: boolean
      }>((acc, sub) => {
        acc[sub.id] = sub.isSubscribed
        return acc
      }, {})
      form.setFieldsValue(initialValues)
    })
  }, [form])

  const handleOk = async () => {
    try {
      const values = form.getFieldsValue()
      Object.entries(values).map(([mailServiceId, isSubscribed]) =>
        API.emailNotification.update(
          parseInt(mailServiceId, 10),
          Boolean(isSubscribed),
        ),
      )

      message.success('Notification settings updated successfully')
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

  return (
    <div>
      <Form form={form} layout="vertical" onValuesChange={handleFormChange}>
        {subscriptions.map((subscription) => (
          <Form.Item
            key={subscription.id}
            label={<Text strong>{subscription.name}</Text>}
            name={subscription.id}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        ))}
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
